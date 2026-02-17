// R3 Policy 5.1 — Secure PaymentModal
// - Merchant secret removed from client (hash generated server-side)
// - PENDING order created before PayHere window opens
// - notify_url points to server-side callback handler
// - Ticket issuance handled by server callback, NOT client onCompleted
"use client";
import React, { useEffect, useRef } from "react";
import { useState } from "react";

import { error, success } from "@/util/Toastify";

import { useParams } from "next/navigation";
import { getSession } from "next-auth/react";
import { FetchPost } from "@/hooks/useFetch";
import { TicketArray } from "@/app/event/host/[id]/components/HostSideBar";

declare global {
  interface Window {
    payhere: any;
  }
}

type PaymentModalProps = {
  orderId: string;
  item: string;
  amount: number;
  currency: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  ticketArrTemp: TicketArray[];
  totalPrice: number;
  setIsActiveProceedTicketModal: React.Dispatch<React.SetStateAction<boolean>>;
  setTicketArrTemp: React.Dispatch<React.SetStateAction<TicketArray[]>>;
  setTotalPrice: React.Dispatch<React.SetStateAction<number>>;
};

const PaymentModal = (props: PaymentModalProps) => {
  const scriptRef = useRef<any>();

  const orderId = props.orderId;
  const name = props.item;
  const amount = props.amount;
  const currency = props.currency || "LKR";

  // R3 Policy 5.1.1 — Merchant secret REMOVED from client code.
  // Hash and merchantId are fetched from the server at payment time.
  const [paymentHash, setPaymentHash] = useState<string>("");
  const [merchantId, setMerchantId] = useState<string>("");
  const [isReady, setIsReady] = useState(false);

  const params = useParams<{ id: string }>();
  const [userId, setUserId] = useState<string>("");

  // Fetch userId on mount
  useEffect(() => {
    const getUserId = async () => {
      const session = await getSession();
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_URL}/api/v1/user/getUserId`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: session?.user?.email }),
          }
        );
        if (!res.ok) {
          error("Error fetching user id");
          return;
        }
        const data = await res.json();
        setUserId(data.id);
      } catch (e) {
        error("Error fetching user id");
      }
    };
    getUserId();
  }, []);

  // Load PayHere SDK script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.payhere.lk/lib/payhere.js";
    script.async = true;

    script.onload = () => {
      // R3 Policy 5.1.5 — onCompleted only shows confirmation to the user.
      // Actual ticket issuance & income update are handled by the server-side
      // notify callback (POST /api/v1/payment/notify). Never trust client status.
      window.payhere.onCompleted = async function onCompleted(
        paymentId: string
      ) {
        success("Payment completed! Your tickets will be emailed shortly.");
        props.setIsActiveProceedTicketModal(false);
        props.setTicketArrTemp([]);
        props.setTotalPrice(0);
      };

      window.payhere.onDismissed = function onDismissed() {
        error("Payment dismissed");
      };

      window.payhere.onError = function onError(e: string) {
        error(e);
      };
    };

    scriptRef.current = script;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [props]);

  /**
   * R3 Policy 5.1.2 — Create PENDING order + get server-generated hash,
   * then open PayHere payment window.
   */
  async function pay() {
    if (!userId) {
      error("User not loaded. Please try again.");
      return;
    }

    try {
      // Step 1: Create a PENDING PaymentOrder on the server
      const orderRes = await FetchPost({
        endpoint: "payment/create-order",
        body: {
          orderId,
          userId,
          eventId: params.id,
          tickets: props.ticketArrTemp.map((t: TicketArray) => ({
            typeId: t.typeId,
            classType: t.type,
            quantity: 1,
          })),
          amount: props.totalPrice,
          currency,
        },
      });

      if (!orderRes?.success) {
        error("Failed to create payment order");
        return;
      }

      // Step 2: Get hash from server (merchant secret stays server-side)
      const hashRes = await fetch(
        `${process.env.NEXT_PUBLIC_URL}/api/v1/payment/generate-hash`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            amount: props.totalPrice,
            currency,
          }),
        }
      );

      if (!hashRes.ok) {
        error("Failed to generate payment hash");
        return;
      }

      const hashData = await hashRes.json();

      // Step 3: Open PayHere with server-generated hash
      // R3 Policy 5.1 — notify_url points to the secure server callback
      const payment = {
        sandbox: true,
        merchant_id: hashData.merchantId,
        return_url: `${process.env.NEXT_PUBLIC_URL}/`,
        cancel_url: `${process.env.NEXT_PUBLIC_URL}/`,
        notify_url: `${process.env.NEXT_PUBLIC_URL}/api/v1/payment/notify`,
        order_id: orderId,
        items: name,
        amount: props.totalPrice,
        currency: currency,
        first_name: props.first_name,
        last_name: props.last_name,
        email: props.email,
        phone: props.phone,
        address: props.address,
        city: props.city,
        country: props.country,
        hash: hashData.hash,
      };

      window.payhere.startPayment(payment);
    } catch (e) {
      console.error("Payment initiation error:", e);
      error("Failed to initiate payment");
    }
  }

  return (
    <>
      <button
        onClick={pay}
        className="flex button  px-4 py-1 bg-[#D47151] rounded-2xl items-center  "
      >
        <div className="font-medium xl:text-lg text-md text-white text-left leading-tight ">
          Pay Now
        </div>
      </button>
    </>
  );
};

export default PaymentModal;

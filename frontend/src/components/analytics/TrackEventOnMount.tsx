"use client";

import { useEffect, useRef } from "react";

import { trackLoginView, trackPayView } from "@/lib/analytics/events";

type Props =
  | {
      event: "login_view";
      locale: string;
    }
  | {
      event: "pay_view";
      locale: string;
    };

export function TrackEventOnMount(props: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    if (props.event === "login_view") {
      trackLoginView(props.locale);
      return;
    }

    trackPayView(props.locale);
  }, [props]);

  return null;
}

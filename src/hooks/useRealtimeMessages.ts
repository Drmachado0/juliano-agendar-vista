import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MensagemWhatsApp } from "@/services/mensagens";

interface UseRealtimeMessagesProps {
  onNewMessage: (message: MensagemWhatsApp) => void;
}

export const useRealtimeMessages = ({ onNewMessage }: UseRealtimeMessagesProps) => {
  const handleInsert = useCallback(
    (payload: any) => {
      console.log("Nova mensagem recebida via realtime:", payload);
      const newMessage = payload.new as MensagemWhatsApp;
      onNewMessage(newMessage);
    },
    [onNewMessage]
  );

  useEffect(() => {
    console.log("Iniciando subscription Supabase Realtime para mensagens_whatsapp");

    const channel = supabase
      .channel("mensagens_whatsapp_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens_whatsapp",
        },
        handleInsert
      )
      .subscribe((status) => {
        console.log("Status da subscription:", status);
      });

    return () => {
      console.log("Removendo subscription Supabase Realtime");
      supabase.removeChannel(channel);
    };
  }, [handleInsert]);
};

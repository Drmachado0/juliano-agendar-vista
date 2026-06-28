import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Quanto tempo leva para marcar a consulta?",
    answer:
      "Muito rápido. Em menos de 1 minuto você escolhe o horário, preenche seus dados e envia o pedido. Nossa equipe confirma em até 2 horas úteis.",
  },
  {
    question: "Como recebo a confirmação do agendamento?",
    answer:
      "Você recebe a confirmação pelo WhatsApp com a data, o local de atendimento e as orientações para o dia da consulta.",
  },
  {
    question: "Posso cancelar ou remarcar?",
    answer:
      "Sim, sem problema. Basta avisar com antecedência pelo WhatsApp ou pelo telefone da clínica. Nós ajustamos o horário para você.",
  },
];

const AgendarFAQSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="agendar-faq"
      className="py-12 md:py-16 bg-gradient-to-b from-card via-background to-secondary/20 relative noise-overlay"
      ref={sectionRef}
      aria-labelledby="agendar-faq-heading"
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4 max-w-3xl">
        <div
          className={`text-center mb-10 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6 uppercase tracking-[0.08em]">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Tire suas dúvidas
          </span>
          <h2
            id="agendar-faq-heading"
            className="text-2xl md:text-3xl font-bold text-foreground mb-3"
          >
            Perguntas <span className="gradient-text">frequentes</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Respostas rápidas para você se sentir seguro antes de agendar.
          </p>
        </div>

        <div
          className={`card-glass rounded-2xl border border-border/40 overflow-hidden transition-all duration-700 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Accordion type="single" collapsible className="px-5 md:px-7">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-b border-border/40 last:border-b-0"
              >
                <AccordionTrigger className="text-left text-sm md:text-base font-semibold text-foreground py-5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default AgendarFAQSection;

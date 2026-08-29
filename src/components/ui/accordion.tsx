import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    // forceMount mantem a resposta no DOM mesmo com o item fechado.
    //
    // POR QUE: sem ele o Radix desmonta o conteudo fechado, e no HTML que o
    // SSG gera a regiao sai como <div hidden=""></div>, vazia. A auditoria de
    // 28/08/2026 contou 57 respostas de FAQ nessa situacao, nas 11 paginas de
    // procedimento e na /paragominas. O texto existia so dentro do JSON-LD do
    // FAQPage, invisivel para qualquer extrator que le corpo de pagina. O
    // Google executa JS e hidrata, entao ele via. Quem nao executa, nao via.
    forceMount
    // data-[state=closed]:h-0 existe por causa do forceMount.
    //
    // Sem forceMount o Radix desmonta o conteudo fechado e nada disso importa.
    // COM forceMount ele mantem o no e deixa de aplicar o atributo `hidden`, e
    // ai o colapso passaria a depender so de `animate-accordion-up` — que e
    // "0.2s ease-out" SEM fill-mode forwards. Animacao sem forwards nao retem o
    // estado final: o elemento volta a altura natural quando ela termina, e na
    // primeira renderizacao (fechado, sem nunca ter animado) ela nem roda. O
    // resultado seria o FAQ inteiro aberto na tela.
    //
    // h-0 + overflow-hidden colapsa de verdade e mantem o texto no DOM, que e o
    // ponto: resposta legivel por extrator, sem recorrer a display:none.
    // SEM transition aqui, de proposito. O colapso vem dos keyframes
    // accordion-up e accordion-down do tailwind.config.ts, e animacao CSS vence
    // transition na mesma propriedade. Alem disso height de auto para 0 nao
    // transiciona. A classe transition-all que existia ate 29/08/2026 nunca
    // produziu efeito, e com forceMount ela passaria a fazer o motor de estilo
    // vigiar toda propriedade animavel em 96 regioes a cada recalculo.
    className="overflow-hidden text-sm data-[state=closed]:h-0 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };

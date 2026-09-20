# Dr. JulianoMachado

**Prompt para o Lovable**

Crie um site de agendamento de consultas para o médico oftalmologista **Dr. Juliano Machado**.

Use como referência de informações e estilo as páginas:

* [https://drjulianomachado.com/](https://drjulianomachado.com/)
* [https://agendarconsulta.com/perfil/dr-dr-juliano-machado-1720017204?origin=profile_search](https://agendarconsulta.com/perfil/dr-dr-juliano-machado-1720017204?origin=profile_search)

O site deve ter:

### Landing page

* Cabeçalho com foto ou ícone de olho, nome **“Dr. Juliano Machado – Oftalmologia”** e botão em destaque **“Agendar consulta”**.
* Seções curtas:

  * **Sobre** (mini bio do médico, experiência e especialidades).
  * **Locais de atendimento** (Clinicor – Paragominas, Hospital Geral de Paragominas – HGP, Belém – IOB/Vitria).
  * **Convênios atendidos** (Particular, Bradesco, Unimed, Cassi, Sul América).
* Botão fixo de **WhatsApp** flutuante.
* Estilo **moderno, clean, levemente dark, profissional médico**, com destaques em **azul/verde** e totalmente responsivo (ótimo em celular).

---

### Formulário de agendamento em passos (multi-step)

#### Step 1 – Dados pessoais

Manter apenas estes campos:

* **Nome completo** (obrigatório)
* **Telefone (WhatsApp obrigatório)** (obrigatório)
* **Data de nascimento**
* **E-mail**

(⚠️ Remover CPF, Cidade/Bairro e a pergunta “Como você nos conheceu?”.)

---

#### Step 2 – Detalhes da consulta

* **Tipo de atendimento:**

  * Consulta
  * Retorno
  * Exame (campo visual, OCT, mapeamento etc.)
  * Cirurgia (catarata, pterígio etc.)

* **Local do atendimento:**

  * Clinicor – Paragominas
  * Hospital Geral de Paragominas
  * Belém (IOB / Vitria)

* **Convênio:**

  * Particular
  * Bradesco
  * Unimed
  * Cassi
  * Sul América
  * Outro (campo de texto)

(⚠️ Remover o campo de texto “Queixa principal / motivo da consulta”.)

---

#### Step 3 – Escolha de data e horário

* Seletor de data em formato de **calendário**.
* Lista de **horários disponíveis** para o dia escolhido.
* Checkbox: **“Aceito o primeiro horário disponível se não houver vaga no horário escolhido”**.
* Checkbox: **“Aceito receber confirmação e lembretes por WhatsApp/E-mail”**.
* Deixar o código preparado para futura integração com **Google Calendar ou Calendly**.

---

#### Step 4 – Confirmação

* Mostrar um **resumo** de todos os dados do paciente e da consulta.
* Botão **“Confirmar agendamento”**.
* Após confirmar, exibir mensagem:

  > “Seu pedido de agendamento foi enviado. Nossa equipe entrará em contato pelo WhatsApp para confirmar o horário.”
* Botão para abrir um link direto do **WhatsApp** da clínica.

---

### Regras de UX e técnicas

* Usar **validação de campos obrigatórios**.
* Mostrar claramente o passo atual (ex.: 1/4, 2/4, 3/4, 4/4).
* Incluir botões **“Voltar”** e **“Avançar”** em todos os steps.
* Site leve, com **carregamento rápido** e layout otimizado para dispositivos móveis.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://juliano-agendar-vista.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e5291dc7-2065-4dfc-9149-64aa4c0a0ce6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

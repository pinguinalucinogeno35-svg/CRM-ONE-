import type { SVGProps } from "react";

// Conjunto próprio: viewBox 24, traço 1.75, pontas arredondadas.
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

/** Marca: um anel aberto com o ponto do "1" atravessando. */
export function LogoMark(props: P) {
  return (
    <Icon strokeWidth="2.25" {...props}>
      <path d="M17.5 6.2A8 8 0 1 0 20 12" />
      <path d="M12 8.5v7" />
    </Icon>
  );
}

/** Painel: três colunas de funil em alturas decrescentes. */
export function IconPanel(props: P) {
  return (
    <Icon {...props}>
      <path d="M5 4.5v15M12 4.5v10M19 4.5v5.5" />
      <path d="M3.5 4.5h17" />
    </Icon>
  );
}

/** Clientes: fachada com porta e duas janelas. */
export function IconClients(props: P) {
  return (
    <Icon {...props}>
      <path d="M4.5 20V7.5L12 4l7.5 3.5V20" />
      <path d="M3 20h18M10 20v-4.5h4V20M9 10.5h.01M15 10.5h.01" />
    </Icon>
  );
}

/** Conta: busto dentro de um cartão. */
export function IconAccount(props: P) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M7.5 17c.8-2 2.5-3 4.5-3s3.7 1 4.5 3" />
    </Icon>
  );
}

/** Sair: porta com traço de saída. */
export function IconSignOut(props: P) {
  return (
    <Icon {...props}>
      <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
      <path d="M10.5 12h9M16.5 8.5 20 12l-3.5 3.5" />
    </Icon>
  );
}

export function IconPlus(props: P) {
  return (
    <Icon {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Icon>
  );
}

export function IconChevron(props: P) {
  return (
    <Icon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  );
}

export function IconBack(props: P) {
  return (
    <Icon {...props}>
      <path d="M19 12H5.5M11 6.5 5.5 12l5.5 5.5" />
    </Icon>
  );
}

/** Copiar: duas folhas sobrepostas. */
export function IconCopy(props: P) {
  return (
    <Icon {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 5.5v-.5a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 5v8A1.5 1.5 0 0 0 6 14.5h.5" />
    </Icon>
  );
}

export function IconDone(props: P) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

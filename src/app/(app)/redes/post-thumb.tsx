"use client";

import { useState } from "react";

/** Miniatura de publicação. Os endereços da Meta expiram; se falhar, some em vez de mostrar imagem quebrada. */
export function PostThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // Endereços temporários da Meta, fora do otimizador de imagens.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-full object-cover"
    />
  );
}

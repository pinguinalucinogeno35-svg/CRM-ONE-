"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * useActionState sem perder o que foi digitado: por padrão o React limpa o
 * formulário após cada envio, inclusive quando o servidor devolve um erro.
 * Aqui o envio é feito manualmente; com `resetOnSuccess`, limpa só no sucesso.
 * Sem JavaScript, o `action` continua funcionando normalmente.
 */
export function useFormAction(action: Action, { resetOnSuccess = false } = {}) {
  const [state, dispatch, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.success) ref.current?.reset();
  }, [resetOnSuccess, state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return { state, pending, formProps: { ref, action: dispatch, onSubmit } };
}

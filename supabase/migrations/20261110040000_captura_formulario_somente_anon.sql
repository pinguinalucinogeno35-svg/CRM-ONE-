-- O formulário público é sempre chamado sem sessão (papel anon); usuários
-- logados não precisam de acesso direto a estas funções.
revoke execute on function public.get_public_form(text) from authenticated;
revoke execute on function public.submit_public_lead(text, text, text, text, text) from authenticated;

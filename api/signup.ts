import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { name, email, password } = (req.body ?? {}) as Record<string, unknown>

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80)
    return res.status(400).json({ error: 'Informe seu nome (2 a 80 caracteres).' })
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()))
    return res.status(400).json({ error: 'E-mail inválido.' })
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'A senha precisa de pelo menos 8 caracteres.' })

  // Cria a conta já confirmada (sem depender do SMTP do Supabase).
  // O trigger on_auth_user_created cria o workspace automaticamente.
  const { error } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: name.trim() },
  })

  if (error) {
    if (error.code === 'email_exists')
      return res.status(409).json({ error: 'Este e-mail já tem uma conta. Faça login.' })
    if (error.code === 'weak_password')
      return res.status(400).json({ error: 'Senha muito fraca. Use uma senha mais longa.' })
    console.error('Falha no cadastro:', error.message)
    return res.status(500).json({ error: 'Não foi possível criar a conta. Tente novamente.' })
  }

  return res.status(201).json({ ok: true })
}

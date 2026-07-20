import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { login, captchaToken, redirectTo } = await req.json()
    if (!login) throw new Error('login required')
    if (!captchaToken) throw new Error('captchaToken required')

    // Серверна перевірка Turnstile-токена — визначальний захист, оскільки
    // Supabase-тумблер "Enable Captcha protection" вимкнено (він єдиний на
    // всі auth-ендпоінти разом, а нам треба captcha тільки на відновленні
    // пароля, не на вході). Токен ніколи не довіряємо клієнту без перевірки.
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
        response: captchaToken,
      }),
    })
    const verifyJson = await verifyRes.json()
    if (!verifyJson.success) throw new Error('Captcha verification failed')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let email = login.includes('@') ? login.toLowerCase() : null
    if (!email) {
      const { data: found } = await supabase.rpc('get_email_by_login', { p_login: login.toLowerCase() })
      email = found || null
    }

    // Якщо логін не знайдено — все одно повертаємо ok:true (щоб не давати
    // змогу перебором дізнаватись, які логіни існують), просто нічого не шлемо
    if (email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

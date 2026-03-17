import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

export default function Login() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState('')
  const [modo, setModo]         = useState('login') // login | convite

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/')
    })
  }, [])

  async function entrar(e) {
    e.preventDefault()
    setLoading(true); setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha incorretos.')
    else router.replace('/')
    setLoading(false)
  }

  async function enviarConvite(e) {
    e.preventDefault()
    setLoading(true); setErro('')
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}/` }
    })
    if (error) setErro(error.message)
    else setErro('✅ Convite enviado! Verifique o e-mail.')
    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>New Tech Automação · Login</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800&display=swap" rel="stylesheet"/>
      </Head>
      <div style={{
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'linear-gradient(135deg,#0d1b2a,#1b263b,#0d1b2a)',
        fontFamily:"'Barlow Condensed',sans-serif", padding:'16px'
      }}>
        {/* Glow de fundo */}
        <div style={{position:'fixed',top:'20%',left:'50%',transform:'translateX(-50%)',
          width:'500px',height:'500px',background:'rgba(245,158,11,.04)',
          borderRadius:'50%',filter:'blur(80px)',pointerEvents:'none'}}/>

        <div style={{
          background:'rgba(12,26,46,.95)', border:'1px solid rgba(255,255,255,.09)',
          borderRadius:'16px', padding:'40px 36px', width:'100%', maxWidth:'420px',
          boxShadow:'0 24px 64px rgba(0,0,0,.6)', position:'relative'
        }}>
          {/* Logo */}
          <div style={{textAlign:'center', marginBottom:'32px'}}>
            <div style={{
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              width:'64px', height:'64px', background:'rgba(245,158,11,.12)',
              borderRadius:'16px', marginBottom:'16px', border:'1px solid rgba(245,158,11,.25)'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <div style={{fontSize:'26px', fontWeight:'800', color:'#f59e0b', letterSpacing:'2px'}}>NEW TECH</div>
            <div style={{fontSize:'11px', color:'#3d5a80', letterSpacing:'3px', textTransform:'uppercase'}}>Automação · Projetos</div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex', background:'rgba(255,255,255,.04)', borderRadius:'9px', padding:'4px', marginBottom:'24px'}}>
            {['login','convite'].map(m => (
              <button key={m} onClick={() => { setModo(m); setErro(''); }}
                style={{
                  flex:1, padding:'8px', border:'none', borderRadius:'7px', cursor:'pointer',
                  fontFamily:"'Barlow Condensed',sans-serif", fontSize:'13px', fontWeight:'700',
                  background: modo===m ? '#f59e0b' : 'none',
                  color: modo===m ? '#000' : '#4b6fa0',
                  transition:'all .15s'
                }}>
                {m === 'login' ? '🔐 Entrar' : '✉ Convidar'}
              </button>
            ))}
          </div>

          <form onSubmit={modo === 'login' ? entrar : enviarConvite}>
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block', fontSize:'10px', color:'#3d5a80', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'monospace'}}>
                E-mail
              </label>
              <input
                type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                placeholder="seu@email.com.br"
                style={{width:'100%', borderRadius:'8px', padding:'10px 13px', fontSize:'14px'}}
              />
            </div>
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block', fontSize:'10px', color:'#3d5a80', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'monospace'}}>
                Senha {modo==='convite' && <span style={{fontWeight:'400', textTransform:'none'}}>(defina uma senha para o convidado)</span>}
              </label>
              <input
                type="password" value={senha} onChange={e=>setSenha(e.target.value)} required
                placeholder="••••••••" minLength={6}
                style={{width:'100%', borderRadius:'8px', padding:'10px 13px', fontSize:'14px'}}
              />
            </div>

            {erro && (
              <div style={{
                background: erro.startsWith('✅') ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                border: `1px solid ${erro.startsWith('✅') ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
                borderRadius:'8px', padding:'10px 13px', marginBottom:'16px',
                fontSize:'13px', color: erro.startsWith('✅') ? '#22c55e' : '#f87171'
              }}>{erro}</div>
            )}

            <button type="submit" disabled={loading}
              style={{
                width:'100%', padding:'12px', border:'none', borderRadius:'9px', cursor:'pointer',
                fontFamily:"'Barlow Condensed',sans-serif", fontSize:'15px', fontWeight:'700',
                background: loading ? 'rgba(245,158,11,.5)' : '#f59e0b',
                color:'#000', transition:'all .15s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(245,158,11,.3)'
              }}>
              {loading ? '...' : modo === 'login' ? '→ Entrar no sistema' : '✉ Enviar convite'}
            </button>
          </form>

          <p style={{textAlign:'center', marginTop:'20px', fontSize:'11px', color:'#1e3a5f'}}>
            New Tech Automação · Acesso restrito
          </p>
        </div>
      </div>
    </>
  )
}

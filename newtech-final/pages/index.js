import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

// ── Colunas Kanban ────────────────────────────────────────────
const COLUNAS = [
  { id:'overdue',  label:'Vencido',          cor:'#ef4444', bg:'rgba(127,29,29,.85)' },
  { id:'today',    label:'Vencimento hoje',   cor:'#f59e0b', bg:'rgba(120,53,15,.85)' },
  { id:'week',     label:'Esta semana',       cor:'#3b82f6', bg:'rgba(30,58,95,.85)'  },
  { id:'2weeks',   label:'Próx. 2 semanas',  cor:'#a78bfa', bg:'rgba(59,7,100,.85)'  },
  { id:'nodate',   label:'Sem prazo',         cor:'#64748b', bg:'rgba(30,41,59,.85)'  },
  { id:'future',   label:'Futuro',            cor:'#34d399', bg:'rgba(6,78,59,.85)'   },
  { id:'done',     label:'Concluído',         cor:'#22c55e', bg:'rgba(20,83,45,.85)'  },
]

const AVC = ['#f59e0b','#3b82f6','#8b5cf6','#10b981','#ef4444','#ec4899','#06b6d4','#84cc16']
function avc(n){ return n ? AVC[n.charCodeAt(0) % AVC.length] : AVC[0] }
function ini(n){ return n ? n.split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase() : '?' }
function getColId(prazo, status) {
  if (status === 'Concluida' || status === 'Concluído') return 'done'
  if (!prazo) return 'nodate'
  const today = new Date(); today.setHours(0,0,0,0)
  const diff  = Math.ceil((new Date(prazo) - today) / 86400000)
  if (diff < 0)  return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7)  return 'week'
  if (diff <= 14) return '2weeks'
  return 'future'
}

const EMPTY_TASK = {
  titulo:'', descricao:'', status:'Pendente', prioridade:'Normal',
  prazo:'', data_pedido:'', numero_pedido:'', proprietario:'',
  responsavel:'', participantes:'', observadores:'', projeto:'',
  observacoes:'', image_url:''
}

export default function Board() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [tasks, setTasks]       = useState([])
  const [equipe, setEquipe]     = useState([])
  const [busca, setBusca]       = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modal, setModal]       = useState(null)
  const [settings, setSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('equipe')
  const [syncing, setSyncing]   = useState(false)
  const [lastSync, setLastSync] = useState('')
  const [toast, setToast]       = useState(null)
  const [novoNome, setNovoNome]   = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoSenha, setNovoSenha] = useState('')
  const [uploadando, setUploadando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else { setUser(data.session.user); loadAll() }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.replace('/login')
    })
    return () => sub?.subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    const t = setInterval(() => loadTasks(), 30000)
    return () => clearInterval(t)
  }, [])

  async function loadAll() {
    await Promise.all([loadTasks(), loadEquipe()])
  }

  async function loadTasks() {
    setSyncing(true)
    const { data, error } = await supabase.from('tarefas').select('*').order('criado_em', { ascending: false })
    if (!error) {
      setTasks(data || [])
      const now = new Date()
      setLastSync(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`)
    }
    setSyncing(false)
  }

  async function loadEquipe() {
    const { data } = await supabase.from('equipe').select('*').order('nome')
    setEquipe(data || [])
  }

  function showToast(msg, cor = '#f59e0b') {
    setToast({ msg, cor })
    setTimeout(() => setToast(null), 3500)
  }

  async function salvarTarefa(task) {
    setSyncing(true)
    let error
    if (task.id) {
      const { error: e } = await supabase.from('tarefas').update({
        titulo: task.titulo, descricao: task.descricao, status: task.status,
        prioridade: task.prioridade, prazo: task.prazo || null,
        data_pedido: task.data_pedido || null, numero_pedido: task.numero_pedido,
        proprietario: task.proprietario, responsavel: task.responsavel,
        participantes: task.participantes, observadores: task.observadores,
        projeto: task.projeto, observacoes: task.observacoes, image_url: task.image_url,
      }).eq('id', task.id)
      error = e
    } else {
      const { error: e } = await supabase.from('tarefas').insert({
        titulo: task.titulo, descricao: task.descricao, status: task.status,
        prioridade: task.prioridade, prazo: task.prazo || null,
        data_pedido: task.data_pedido || null, numero_pedido: task.numero_pedido,
        proprietario: task.proprietario, responsavel: task.responsavel,
        participantes: task.participantes, observadores: task.observadores,
        projeto: task.projeto, observacoes: task.observacoes, image_url: task.image_url,
      })
      error = e
    }
    if (error) showToast('Erro: ' + error.message, '#ef4444')
    else showToast(task.id ? 'Tarefa atualizada ✓' : 'Tarefa criada ✓', '#22c55e')
    setModal(null)
    loadTasks()
  }

  async function excluirTarefa(id) {
    if (!confirm('Remover esta tarefa?')) return
    await supabase.from('tarefas').delete().eq('id', id)
    showToast('Removida', '#64748b')
    loadTasks()
  }

  async function uploadFoto(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('Máximo 5MB!', '#ef4444'); return }
    setUploadando(true)
    const ext  = file.name.split('.').pop()
    const path = `tarefas/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos-tarefas').upload(path, file, { upsert: true })
    if (error) { showToast('Erro no upload: ' + error.message, '#ef4444'); setUploadando(false); return }
    const { data: urlData } = supabase.storage.from('fotos-tarefas').getPublicUrl(path)
    setModal(prev => ({ ...prev, image_url: urlData.publicUrl }))
    showToast('Foto enviada ✓', '#22c55e')
    setUploadando(false)
  }

  async function convidarMembro(e) {
    e.preventDefault()
    if (!novoNome || !novoEmail || !novoSenha) { showToast('Preencha todos os campos!', '#ef4444'); return }
    
    const { error } = await supabase.from('equipe').insert({ nome: novoNome, email: novoEmail, ativo: true })
    if (error) showToast('Erro: ' + error.message, '#ef4444')
    else {
      showToast('Membro adicionado ✓', '#22c55e')
      setNovoNome(''); setNovoEmail(''); setNovoSenha('')
      loadEquipe()
    }
  }

  async function toggleEquipe(membro) {
    await supabase.from('equipe').update({ ativo: !membro.ativo }).eq('id', membro.id)
    loadEquipe()
  }
  
  async function removerMembro(id) {
    if (!confirm('Remover membro?')) return
    await supabase.from('equipe').delete().eq('id', id)
    loadEquipe()
  }

  const tasksFiltered = tasks.filter(t =>
    (!busca || (t.titulo||'').toLowerCase().includes(busca.toLowerCase()) ||
               (t.numero_pedido||'').toLowerCase().includes(busca.toLowerCase()) ||
               (t.responsavel||'').toLowerCase().includes(busca.toLowerCase()) ||
               (t.projeto||'').toLowerCase().includes(busca.toLowerCase())) &&
    (!filtroStatus || t.status === filtroStatus)
  )

  const countByCol = {}
  COLUNAS.forEach(c => { countByCol[c.id] = 0 })
  tasksFiltered.forEach(t => { const c = getColId(t.prazo, t.status); countByCol[c] = (countByCol[c] || 0) + 1 })
  const overdueCount = countByCol['overdue'] || 0

  if (!user) return null

  return (
    <>
      <Head>
        <title>New Tech Automação · Projetos</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      </Head>

      {/* HEADER */}
      <header style={{
        background:'rgba(10,20,35,.97)', backdropFilter:'blur(12px)',
        borderBottom:'1px solid rgba(255,255,255,.06)', padding:'11px 18px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:200, gap:10, flexWrap:'wrap',
        fontFamily:"'Barlow Condensed',sans-serif"
      }}>
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <div>
            <div style={{fontSize:'20px', fontWeight:'800', color:'#f59e0b', letterSpacing:'1px'}}>NEW TECH</div>
            <div style={{fontSize:'9px', color:'#3d5a80', letterSpacing:'3px', textTransform:'uppercase'}}>Automação · Projetos</div>
          </div>
          <div style={{width:'1px', height:'34px', background:'rgba(255,255,255,.07)'}}/>
          <div style={{display:'flex', alignItems:'center', gap:6, fontSize:'11px', color:'#3d5a80'}}>
            <div style={{
              width:7, height:7, borderRadius:'50%',
              background: syncing ? '#f59e0b' : '#22c55e',
              boxShadow: syncing ? '0 0 8px #f59e0b' : '0 0 6px #22c55e',
              animation: syncing ? 'blink 1s infinite' : 'none'
            }}/>
            <span>{syncing ? 'Sincronizando...' : `Ao vivo · ${lastSync}`}</span>
          </div>
          {overdueCount > 0 && (
            <div style={{background:'#7f1d1d', color:'#fca5a5', fontSize:'11px', padding:'3px 10px', borderRadius:'20px', fontWeight:'700'}}>
              ⚠ {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div style={{display:'flex', gap:7, alignItems:'center', flexWrap:'wrap'}}>
          {/* Busca */}
          <div style={{position:'relative', display:'flex', alignItems:'center'}}>
            <svg style={{position:'absolute', left:9, color:'#3d5a80', pointerEvents:'none'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar tarefa, PO, responsável..."
              style={{borderRadius:'8px', padding:'8px 11px 8px 30px', fontSize:'13px', width:220}}/>
          </div>
          
          <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}
            style={{borderRadius:'8px', padding:'8px 11px', fontSize:'13px'}}>
            <option value="">Todos</option>
            <option>Pendente</option><option>Em andamento</option>
            <option>Aguardando</option><option>Concluida</option>
          </select>
          
          <button className="btn btn-secondary" onClick={loadTasks}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          
          <button className="btn btn-primary" onClick={() => setModal({...EMPTY_TASK})}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Tarefa
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/relatorio')} style={{fontSize:'12px', padding:'8px 12px'}}>
          📊 Relatório
          </button>

          {/* Botão Projetos */}
          <button className="btn btn-secondary" onClick={() => router.push('/projetos')} style={{fontSize:'12px', padding:'8px 12px'}}>
            📋 Projetos
          </button>

          {/* Configurações */}
          <button className="btn btn-icon" onClick={() => { setSettings(true); setSettingsTab('equipe') }} title="Configurações">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>

          {/* Sair */}
          <button className="btn btn-secondary" onClick={() => supabase.auth.signOut()} style={{fontSize:'12px', padding:'8px 12px'}}>
            Sair
          </button>
        </div>
      </header>

      {/* STATS BAR */}
      <div style={{background:'rgba(10,20,35,.7)', borderBottom:'1px solid rgba(255,255,255,.05)', padding:'6px 18px', display:'flex', gap:14, flexWrap:'wrap', alignItems:'center', fontFamily:"'Barlow Condensed',sans-serif"}}>
        {COLUNAS.filter(c => countByCol[c.id] > 0).map(c => (
          <div key={c.id} style={{display:'flex', alignItems:'center', gap:5, fontSize:'11px'}}>
            <div style={{width:7, height:7, borderRadius:'50%', background:c.cor}}/>
            <span style={{color:'#3d5a80'}}>{c.label}:</span>
            <span style={{color:c.cor, fontWeight:'700'}}>{countByCol[c.id]}</span>
          </div>
        ))}
        <div style={{marginLeft:'auto', color:'#1e3a5f', fontSize:'11px'}}>{tasksFiltered.length} tarefa{tasksFiltered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* BOARD */}
      <div style={{display:'flex', overflowX:'auto', minHeight:'calc(100vh - 100px)', padding:'0 2px', fontFamily:"'Barlow Condensed',sans-serif"}}>
        {COLUNAS.map(col => {
          const colTasks = tasksFiltered.filter(t => getColId(t.prazo, t.status) === col.id)
          return (
            <div key={col.id} style={{minWidth:268, width:268, flexShrink:0, borderRight:'1px solid rgba(255,255,255,.04)', display:'flex', flexDirection:'column'}}>
              {/* Header coluna */}
              <div style={{
                padding:'10px 12px', background:'rgba(10,20,35,.85)', backdropFilter:'blur(6px)',
                borderBottom:'1px solid rgba(255,255,255,.05)', position:'sticky', top:56, zIndex:10,
                display:'flex', alignItems:'center', justifyContent:'space-between'
              }}>
                <div style={{display:'flex', alignItems:'center', gap:7, fontSize:'11px', fontWeight:'700', color:'#cbd5e1', textTransform:'uppercase', letterSpacing:'1px'}}>
                  <div style={{width:9, height:9, borderRadius:'50%', background:col.cor, boxShadow:`0 0 6px ${col.cor}55`}}/>
                  {col.label}
                </div>
                <div style={{fontSize:'10px', padding:'2px 7px', borderRadius:'20px', fontWeight:'700', background:col.bg, color:col.cor}}>{colTasks.length}</div>
              </div>

              {/* Cards */}
              <div style={{flex:1, padding:'9px', overflowY:'auto'}}>
                {colTasks.length === 0 && <div style={{textAlign:'center', padding:'32px 0', color:'rgba(255,255,255,.1)', fontSize:'12px'}}>— vazio —</div>}
                {colTasks.map(t => <Card key={t.id} task={t} col={col} onOpen={setModal} onDelete={excluirTarefa}/>)}
                <button
                  onClick={() => setModal({...EMPTY_TASK, status: col.id === 'done' ? 'Concluida' : 'Pendente'})}
                  style={{
                    width:'100%', background:'none', border:'1px dashed rgba(255,255,255,.1)', borderRadius:'8px',
                    padding:'9px', color:'rgba(255,255,255,.2)', cursor:'pointer', fontSize:'11px',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    transition:'all .15s', fontFamily:"'Barlow Condensed',sans-serif", marginTop:4
                  }}
                  onMouseEnter={e=>{e.target.style.borderColor=col.cor;e.target.style.color=col.cor}}
                  onMouseLeave={e=>{e.target.style.borderColor='rgba(255,255,255,.1)';e.target.style.color='rgba(255,255,255,.2)'}}>
                  + Adicionar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL TAREFA */}
      {modal && (
        <TaskModal
          task={modal} equipe={equipe}
          uploadando={uploadando}
          onUpload={uploadFoto}
          onSave={salvarTarefa}
          onClose={() => setModal(null)}
          onChange={setModal}
        />
      )}

      {/* SETTINGS */}
      {settings && (
        <SettingsModal
          equipe={equipe} tab={settingsTab} setTab={setSettingsTab}
          novoNome={novoNome} setNovoNome={setNovoNome}
          novoEmail={novoEmail} setNovoEmail={setNovoEmail}
          novoSenha={novoSenha} setNovoSenha={setNovoSenha}
          onConvidar={convidarMembro}
          onToggle={toggleEquipe} onRemover={removerMembro}
          onClose={() => setSettings(false)}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position:'fixed', bottom:22, right:22, background:'#0c1a2e', color:'#e5e7eb',
          padding:'12px 18px', borderRadius:'10px', fontSize:'13px', zIndex:999,
          borderLeft:`3px solid ${toast.cor}`, boxShadow:'0 8px 32px rgba(0,0,0,.5)',
          fontFamily:"'Barlow Condensed',sans-serif", maxWidth:300,
          animation:'slideUp .3s ease'
        }}>{toast.msg}</div>
      )}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
    </>
  )
}

// ── Card ──────────────────────────────────────────────────────
function Card({ task: t, col, onOpen, onDelete }) {
  const isOv = getColId(t.prazo, t.status) === 'overdue'
  const priC = { Normal:['rgba(55,65,81,.8)','#9ca3af'], Alta:['rgba(120,53,15,.8)','#fbbf24'], Urgente:['rgba(127,29,29,.8)','#f87171'] }
  const [pc, tc2] = priC[t.prioridade] || priC.Normal
  const all = [t.responsavel, ...(t.participantes||'').split(',').map(s=>s.trim()).filter(Boolean)].filter(Boolean)
  const [hover, setHover] = useState(false)

  return (
    <div
      onClick={() => onOpen({...t})}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:'rgba(22,35,58,.9)', border:`1px solid rgba(255,255,255,.07)`,
        borderLeft:`3px solid ${col.cor}`, borderRadius:'11px', cursor:'pointer',
        transition:'transform .15s, box-shadow .15s', marginBottom:'8px', overflow:'hidden',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? `0 6px 20px ${col.cor}33` : 'none',
      }}>

      {t.image_url && (
        <div style={{width:'100%', height:115, overflow:'hidden', background:'#0d1b2a'}}>
          <img src={t.image_url} alt="" style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}}
            onError={e=>e.target.parentElement.style.display='none'}/>
        </div>
      )}

      <div style={{padding:'10px 12px'}}>
        {t.numero_pedido && <div style={{fontSize:'10px', color:'#3d5a80', fontFamily:'monospace', marginBottom:3}}>#{t.numero_pedido}</div>}
        <div style={{fontSize:'13px', fontWeight:'700', color:'#e2e8f0', lineHeight:1.4, marginBottom:7}}>
          {t.titulo || '(sem título)'}
        </div>
        <div style={{display:'flex', gap:4, flexWrap:'wrap', marginBottom:7}}>
          <span style={{fontSize:'9px', padding:'2px 6px', borderRadius:'3px', fontWeight:'700', letterSpacing:'.8px', textTransform:'uppercase', background:pc, color:tc2}}>{t.prioridade}</span>
          <span style={{fontSize:'9px', padding:'2px 6px', borderRadius:'3px', fontWeight:'700', letterSpacing:'.8px', textTransform:'uppercase', background:'rgba(255,255,255,.06)', color:'#94a3b8'}}>{t.status}</span>
          {t.projeto && <span style={{fontSize:'9px', padding:'2px 6px', borderRadius:'3px', fontWeight:'700', background:'rgba(255,255,255,.04)', color:'#475569'}}>{t.projeto.substring(0,22)}</span>}
        </div>
        {t.prazo && (
          <div style={{display:'flex', alignItems:'center', gap:4, fontSize:'10px', color: isOv ? '#f87171' : '#3d5a80', marginBottom:7}}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {isOv ? '⚠ ' : ''}{t.prazo}
          </div>
        )}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{display:'flex'}}>
            {all.slice(0,4).map((p,i) => (
              <div key={i} style={{width:22, height:22, borderRadius:'50%', background:avc(p), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'8px', fontWeight:'700', color:'#fff', border:'2px solid rgba(10,20,35,.9)', marginLeft: i>0?'-5px':'0', flexShrink:0}}>{ini(p)}</div>
            ))}
            {all.length > 4 && <div style={{width:22, height:22, borderRadius:'50%', background:'#334155', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'7px', color:'#94a3b8', border:'2px solid rgba(10,20,35,.9)', marginLeft:'-5px'}}>+{all.length-4}</div>}
          </div>
          <button onClick={e=>{e.stopPropagation();onDelete(t.id)}}
            style={{background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.15)', padding:'3px', borderRadius:'4px', lineHeight:0, transition:'color .1s'}}
            onMouseEnter={e=>e.target.style.color='#ef4444'}
            onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Tarefa ──────────────────────────────────────────────
function TaskModal({ task, equipe, uploadando, onUpload, onSave, onClose, onChange }) {
  const f = (k) => (v) => onChange(prev => ({ ...prev, [k]: v }))
  const ativos = equipe.filter(m => m.ativo)

  function togglePessoa(key, nome) {
    const sel = (task[key]||'').split(',').map(s=>s.trim()).filter(Boolean)
    const idx = sel.indexOf(nome)
    if (idx >= 0) { sel.splice(idx, 1) } else { sel.push(nome) }
    onChange(prev => ({...prev, [key]: sel.join(', ')}))
  }

  function handleSubmit() {
    if (!task.titulo?.trim()) { alert('Informe o título!'); return }
    onSave(task)
  }

  const S = {
    overlay: {position:'fixed',inset:0,background:'rgba(0,0,0,.82)',backdropFilter:'blur(5px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:14},
    panel: {background:'#0c1a2e',border:'1px solid rgba(255,255,255,.1)',borderRadius:14,width:'100%',maxWidth:680,maxHeight:'93vh',overflowY:'auto',padding:24,boxShadow:'0 24px 64px rgba(0,0,0,.7)',fontFamily:"'Barlow Condensed',sans-serif"},
    label: {display:'block',fontSize:'10px',color:'#3d5a80',marginBottom:4,textTransform:'uppercase',letterSpacing:'1px',fontFamily:'monospace'},
    input: {width:'100%',borderRadius:'7px',padding:'8px 11px',fontSize:'13px'},
    field: {marginBottom:12},
    row2: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:11},
  }

  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.panel}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{color:'#f59e0b',fontSize:'19px',fontWeight:'700',letterSpacing:'1px'}}>
            {task.id ? '✦ Editar Tarefa' : '✦ Nova Tarefa'}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#3d5a80',padding:4,lineHeight:0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={S.field}>
          <label style={S.label}>Título da tarefa *</label>
          <input style={S.input} value={task.titulo||''} onChange={e=>f('titulo')(e.target.value)} placeholder="Ex: KNORR - NR12 em máquinas..."/>
        </div>

        <div style={S.field}>
          <label style={S.label}>Descrição / Escopo</label>
          <textarea style={{...S.input,resize:'vertical',minHeight:68}} value={task.descricao||''} onChange={e=>f('descricao')(e.target.value)}/>
        </div>

        <div style={S.row2}>
          <div style={S.field}>
            <label style={S.label}>Status</label>
            <select style={S.input} value={task.status||'Pendente'} onChange={e=>f('status')(e.target.value)}>
              {['Pendente','Em andamento','Aguardando','Concluida'].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={S.field}>
            <label style={S.label}>Prioridade</label>
            <select style={S.input} value={task.prioridade||'Normal'} onChange={e=>f('prioridade')(e.target.value)}>
              {['Normal','Alta','Urgente'].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={S.field}>
            <label style={S.label}>Nº Pedido / PO</label>
            <input style={S.input} value={task.numero_pedido||''} onChange={e=>f('numero_pedido')(e.target.value)} placeholder="4500012345"/>
          </div>
          <div style={S.field}>
            <label style={S.label}>Prazo de Entrega</label>
            <input type="date" style={S.input} value={task.prazo||''} onChange={e=>f('prazo')(e.target.value)}/>
          </div>
          <div style={S.field}>
            <label style={S.label}>Data do Pedido</label>
            <input type="date" style={S.input} value={task.data_pedido||''} onChange={e=>f('data_pedido')(e.target.value)}/>
          </div>
          <div style={S.field}>
            <label style={S.label}>Projeto / Cliente</label>
            <input style={S.input} value={task.projeto||''} onChange={e=>f('projeto')(e.target.value)} placeholder="KNORR Rio Claro"/>
          </div>
        </div>

        <div style={S.field}>
          <label style={S.label}>Proprietário</label>
          <input style={S.input} value={task.proprietario||''} onChange={e=>f('proprietario')(e.target.value)} placeholder="JUNIOR CARANDINA"/>
        </div>

        <div style={S.field}>
          <label style={S.label}>Responsável</label>
          <select style={S.input} value={task.responsavel||''} onChange={e=>f('responsavel')(e.target.value)}>
            <option value="">— selecionar —</option>
            {ativos.map(m=><option key={m.id} value={m.nome}>{m.nome}</option>)}
          </select>
        </div>

        {['participantes','observadores'].map(key => {
          const sel = (task[key]||'').split(',').map(s=>s.trim()).filter(Boolean)
          return (
            <div key={key} style={S.field}>
              <label style={S.label}>{key === 'participantes' ? 'Participantes' : 'Observadores'}</label>
              <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.09)',borderRadius:8,maxHeight:150,overflowY:'auto',padding:4}}>
                {ativos.map(m => (
                  <label key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,cursor:'pointer'}}>
                    <input type="checkbox" checked={sel.includes(m.nome)} onChange={()=>togglePessoa(key,m.nome)}
                      style={{width:15,height:15,accentColor:'#f59e0b',cursor:'pointer',flexShrink:0}}/>
                    <div style={{width:26,height:26,borderRadius:'50%',background:avc(m.nome),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff',flexShrink:0}}>{ini(m.nome)}</div>
                    <span style={{fontSize:13,color:'#e2e8f0'}}>{m.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}

        <div style={S.field}>
          <label style={S.label}>Foto da atividade</label>
          <div style={{border:'2px dashed rgba(255,255,255,.12)',borderRadius:9,padding:16,textAlign:'center',cursor:'pointer',transition:'all .2s',position:'relative',minHeight:80,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4}}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='#f59e0b'}}
            onDragLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,.12)'}}
            onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor='rgba(255,255,255,.12)';onUpload(e.dataTransfer.files[0])}}>
            <input type="file" accept="image/*" onChange={e=>onUpload(e.target.files[0])}
              style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}}/>
            {task.image_url ? (
              <img src={task.image_url} alt="" style={{width:'100%',maxHeight:150,objectFit:'cover',borderRadius:7,display:'block'}}/>
            ) : (
              <>
                <span style={{fontSize:26}}>📷</span>
                <span style={{fontSize:12,color:'#3d5a80'}}>Clique ou arraste uma foto</span>
                <span style={{fontSize:10,color:'#1e3a5f'}}>JPG · PNG · WEBP até 5MB</span>
              </>
            )}
            {uploadando && <div style={{position:'absolute',inset:0,background:'rgba(12,26,46,.8)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:7,fontSize:13,color:'#f59e0b'}}>⏳ Enviando...</div>}
          </div>
          <div style={{fontSize:'10px',color:'#3d5a80',marginTop:4}}>Ou cole URL direta:</div>
          <input style={{...S.input,marginTop:4,fontSize:12}} value={task.image_url||''} onChange={e=>f('image_url')(e.target.value)} placeholder="https://..."/>
        </div>

        <div style={S.field}>
          <label style={S.label}>Observações</label>
          <textarea style={{...S.input,resize:'vertical',minHeight:68}} value={task.observacoes||''} onChange={e=>f('observacoes')(e.target.value)}/>
        </div>

        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:10,paddingTop:10,borderTop:'1px solid rgba(255,255,255,.06)'}}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={uploadando}>
            ✦ {task.id ? 'Salvar alterações' : 'Criar Tarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Settings Modal ────────────────────────────────────────────
function SettingsModal({ equipe, tab, setTab, novoNome, setNovoNome, novoEmail, setNovoEmail, novoSenha, setNovoSenha, onConvidar, onToggle, onRemover, onClose }) {
  const S = {
    overlay: {position:'fixed',inset:0,background:'rgba(0,0,0,.82)',backdropFilter:'blur(5px)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:14},
    panel: {background:'#0c1a2e',border:'1px solid rgba(255,255,255,.1)',borderRadius:14,width:'100%',maxWidth:600,maxHeight:'88vh',overflowY:'auto',padding:24,boxShadow:'0 24px 64px rgba(0,0,0,.7)',fontFamily:"'Barlow Condensed',sans-serif"},
    input: {borderRadius:'7px',padding:'8px 10px',fontSize:'13px'},
  }
  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.panel}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{color:'#f59e0b',fontSize:'19px',fontWeight:'700'}}>⚙ Configurações</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#3d5a80',padding:4,lineHeight:0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{display:'flex',gap:4,marginBottom:20,background:'rgba(255,255,255,.04)',padding:4,borderRadius:9}}>
          {[['equipe','👥 Equipe'],['acesso','🔐 Acesso'],['sobre','ℹ Sobre']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1,padding:'9px',border:'none',borderRadius:7,cursor:'pointer',
              fontFamily:"'Barlow Condensed',sans-serif",fontSize:'13px',fontWeight:'700',
              background: tab===id ? '#f59e0b' : 'none',
              color: tab===id ? '#000' : '#4b6fa0', transition:'all .15s'
            }}>{lbl}</button>
          ))}
        </div>

        {tab === 'equipe' && (
          <div>
            <p style={{color:'#94a3b8',fontSize:'12px',marginBottom:14}}>Membros <span style={{color:'#22c55e'}}>Ativos</span> aparecem para seleção nas tarefas.</p>
            {equipe.map(m => (
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',background:'rgba(255,255,255,.04)',borderRadius:8,marginBottom:7}}>
                <div style={{width:34,height:34,borderRadius:'50%',background:avc(m.nome),display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>{ini(m.nome)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{m.nome}</div>
                  <div style={{fontSize:11,color:'#4b6fa0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.email}</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-secondary" style={{padding:'5px 10px',fontSize:11}} onClick={()=>onToggle(m)}>
                    {m.ativo ? <span style={{color:'#22c55e'}}>● Ativo</span> : <span style={{color:'#64748b'}}>○ Inativo</span>}
                  </button>
                  <button className="btn btn-danger" style={{padding:'5px 10px',fontSize:11,border:'none'}} onClick={()=>onRemover(m.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'acesso' && (
          <div>
            <p style={{color:'#94a3b8',fontSize:'12px',marginBottom:16}}>Convide pessoas para acessar o sistema.</p>
            <form onSubmit={onConvidar}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <div>
                  <label style={{display:'block',fontSize:'10px',color:'#3d5a80',marginBottom:4}}>Nome</label>
                  <input value={novoNome} onChange={e=>setNovoNome(e.target.value)} required style={{...S.input,width:'100%'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'10px',color:'#3d5a80',marginBottom:4}}>E-mail</label>
                  <input type="email" value={novoEmail} onChange={e=>setNovoEmail(e.target.value)} required style={{...S.input,width:'100%'}}/>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:'10px',color:'#3d5a80',marginBottom:4}}>Senha</label>
                <input type="password" value={novoSenha} onChange={e=>setNovoSenha(e.target.value)} required minLength={6} style={{...S.input,width:'100%'}}/>
              </div>
              <button type="submit" className="btn btn-primary" style={{width:'100%',padding:12}}>
                ✉ Adicionar membro
              </button>
            </form>
          </div>
        )}

        {tab === 'sobre' && (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:26,fontWeight:800,color:'#f59e0b'}}>NEW TECH</div>
            <p style={{color:'#64748b',fontSize:12}}>
              Sistema de gestão de projetos<br/>
              Versão 2.0
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

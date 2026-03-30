'use client'

import { useState, useRef, useEffect } from 'react'

// ─── CSV PARSER ─────────────────────────────────────────────────────────────
function parseLine(line) {
  const result = []; let cur = '', q = false
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { result.push(cur.trim()); cur = '' } else cur += ch }
  result.push(cur.trim()); return result
}
function parseInvoiceCSV(text) {
  const lines = text.trim().split('\n'); if (lines.length < 2) return []
  const h = lines[0].split(',').map(x => x.trim().toLowerCase().replace(/\r/g, ''))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const v = line.split(',').map(x => x.trim()); const o = {}
    h.forEach((k, i) => { o[k] = (v[i] || '').replace(/\r/g, '') })
    return { name: o['name'] || o['product name'] || o['item'] || '', qty: parseInt(o['qty'] || o['quantity'] || '1'), price: parseFloat(o['price'] || o['amount'] || '0'), invoiceNo: o['invoice'] || o['invoice_no'] || o['invoice no'] || 'N/A', customer: o['customer'] || '', city: o['city'] || '' }
  }).filter(i => i.name)
}

// ─── FUZZY MATCH ────────────────────────────────────────────────────────────
function fuzzy(a, b) {
  const na = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const nb = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (na === nb) return 1; if (nb.includes(na) || na.includes(nb)) return 0.9
  const wa = na.split(' ').filter(w => w.length > 2), wb = nb.split(' ').filter(w => w.length > 2)
  return wa.filter(w => wb.some(x => x.includes(w) || w.includes(x))).length / Math.max(wa.length, 1)
}
function findMatch(name, catalog) {
  let best = null, bs = 0
  for (const p of catalog) { const s = fuzzy(name, p.n); if (s > bs) { bs = s; best = p } }
  return bs >= 0.35 ? { ...best, score: bs } : null
}

// ─── DEMO INVOICES ──────────────────────────────────────────────────────────
const DEMO=[{name:"Assam Heritage Black Tea by Deroi Tea | 100% Natural Unblended – 100 g",qty:1,price:349,invoiceNo:"3439",customer:"Gajender Rao",city:"Bangalore"},{name:"Organic T-Tales Organic English Breakfast Assam Black Tea – Strong Morning Brew – Tea Bags – 25 Tea Bags",qty:1,price:200,invoiceNo:"3439",customer:"Gajender Rao",city:"Bangalore"},{name:"Chamraj Peppermint Infusion – 25 Tea Bags – Pack of 2",qty:1,price:250,invoiceNo:"3444",customer:"Apshra Poonia",city:"New Delhi"},{name:"Nilgiri CTC Tea Pack of 2 – Premium Strong Black Leaf Tea – 2 box of 250 g each",qty:1,price:250,invoiceNo:"3445",customer:"Surendra Badoni",city:"New Delhi"},{name:"STG Darjeeling Premium Black Tea – 100 g",qty:2,price:250,invoiceNo:"3451",customer:"Devashri Gawde",city:"Mumbai"},{name:"Lluvia Tea Spearmint Green Tea – Crafted for Hormonal Balance – 50 g",qty:1,price:399,invoiceNo:"3453",customer:"P sanjuna P",city:"Bangalore"},{name:"Korakundah Organic Chamomile Decaf Green Tea – Pack of 2 25 Tea Bags",qty:2,price:300,invoiceNo:"3455",customer:"Aravind S",city:"Bengaluru"},{name:"Korakundah Organic Chamomile Decaf Green Tea – Pack of 2 25 Tea Bags",qty:1,price:300,invoiceNo:"3455",customer:"Aravind S",city:"Bengaluru"},{name:"Korakundah Organic Camomile Herbal Infusion Tea Bags – Pack of 2",qty:1,price:300,invoiceNo:"3459",customer:"kumti Imchen",city:"Dimapur"},{name:"Chamraj Fruit Infusion Tea Bags – Raspberry, Peach, Strawberry & Black Currant – 40 Tea Bags",qty:1,price:320,invoiceNo:"3459",customer:"kumti Imchen",city:"Dimapur"},{name:"Bagicha by Jayshree Tea Aromatic Jasmine Green Tea Bags – Pack of 2",qty:1,price:420,invoiceNo:"3468",customer:"Amarjit Shaheer",city:"Delhi"},{name:"Wah Tea Blueberry Blossom Green Tea – Fruity Floral Blend – 50 g",qty:1,price:250,invoiceNo:"3460",customer:"Saryu Saini",city:"Ghaziabad"},{name:"Wah Blue Lagoon Green Tea – A Vibrant Fusion of Blue Pea Flower & Ginger – 50 g",qty:1,price:250,invoiceNo:"3460",customer:"Saryu Saini",city:"Ghaziabad"},{name:"Golden Tips Green Blush Rose Green Tea – 100 g",qty:1,price:270,invoiceNo:"3471",customer:"Jeeva S",city:"Chennai"},{name:"Organic T-Tales Organic Chamomile Green Tea – Dreamy Sleep Infusion – Tea Bags – 25 Tea Bags",qty:2,price:220,invoiceNo:"3472",customer:"Udita Singh",city:"Udaipur"},{name:"Glendale 100% Natural Lemon Green Tea | Pack Of 2 | High Grown Nilgiri Tea – Pack of 2 100 g Each",qty:1,price:300,invoiceNo:"3476",customer:"Pamela Clarke",city:"Ootacamund"},{name:"Arunika Assam Orthodox Black Tea – Handrolled Tippy Golden Flowery Orange Pekoe – 100 g",qty:1,price:335,invoiceNo:"3477",customer:"Souryyendra Choudhury",city:"Kolkata"},{name:"Dabri Assam Orthodox Black Tea – Majherdabri Tea Estate – 100 g",qty:1,price:150,invoiceNo:"3477",customer:"Souryyendra Choudhury",city:"Kolkata"},{name:"Bagicha By Jayshree Tea Roasted Aromatic Darjeeling Tea – Pack of 2 100 g each",qty:1,price:220,invoiceNo:"3479",customer:"M Mukhopadhyay",city:"Gurgaon"},{name:"Chamraj Green Tea Bags – Finest Nilgiri Tea – Value Pack of 2 – Pack of 2 25 Tea Bags Each",qty:1,price:200,invoiceNo:"3481",customer:"Dhritimedha Das",city:"Silchar"},{name:"Chamraj Green Tea Bags – Finest Nilgiri Tea – Value Pack of 2 – Pack of 2 25 Tea Bags Each",qty:1,price:200,invoiceNo:"3488",customer:"R P Verma",city:"Jammu"},{name:"Gopaldhara Darjeeling First Flush Flowery Broken Orange Pekoe Black Tea – 400 g",qty:1,price:495,invoiceNo:"3492",customer:"Anjan Mukhopadhyay",city:"Vadodara"},{name:"Lluvia Tea Spearmint Green Tea – Crafted for Hormonal Balance – 50 g",qty:1,price:399,invoiceNo:"3493",customer:"Barnamala Roy",city:"Kolkata"},{name:"STG Darjeeling Premium First Flush Tea – Pack of 2 – 50 g Each",qty:1,price:400,invoiceNo:"3495",customer:"Shyamal Ghosh",city:"Howrah"},{name:"Himalayan Brew Kangra Pure Himalayan Detox Kahwa Green Tea – Pack of 2 – 25 Tea Bags X 2",qty:1,price:460,invoiceNo:"3502",customer:"Kapil Dev",city:"Jalandhar"},{name:"Lavender & Rhododendron Herbal Infusion – The Purple Himalayas – 25 g",qty:1,price:350,invoiceNo:"3498",customer:"kavya g",city:"Bangalore"},{name:"Oh Cha Afternoon Boost Green Tea with Peppermint, Nettle and Rose – 50 g",qty:1,price:300,invoiceNo:"3498",customer:"kavya g",city:"Bangalore"},{name:"House of Tumsong Darjeeling First Flush Golden Brew Organic Tea – 100 g",qty:1,price:999,invoiceNo:"3503",customer:"Malay Chakraborty",city:"Barrackpore"},{name:"Golden Tips Roseherb Green Tea – A Soothing Green Tea with Himalayan Herbs – 100 g",qty:1,price:445,invoiceNo:"3504",customer:"PRATIP BASU",city:"Bangalore"},{name:"Himalayan Brew Blooming Flower White Tea with Peony, Marigold, Rose, Jasmine and Lavender – Bouquet of Flavours – 2",qty:1,price:300,invoiceNo:"3508",customer:"Neha Kohli",city:"Ghaziabad"},{name:"STG Darjeeling Premium First Flush Tea – Pack of 2 – 50 g Each",qty:1,price:400,invoiceNo:"3509",customer:"priti kodikal",city:"Bangalore"},{name:"Golden Tips Earl Grey Black Tea in Royal Brocade Cloth Bag – 100 g",qty:1,price:340,invoiceNo:"3510",customer:"KISHAN PRASAD PALAYPU",city:"Hyderabad"},{name:"Gopaldhara Darjeeling Premium Second Flush Black Tea Pyramid Leaf Tea Bag – 40 Pyramid Leaf Tea Bag",qty:1,price:615,invoiceNo:"3522",customer:"Jayashree Shenoy",city:"Mumbai"}]

export default function Home() {
  const [catalog, setCatalog] = useState([])
  const [items, setItems] = useState([])
  const [view, setView] = useState('pick')
  const [pickedSet, setPickedSet] = useState(new Set())
  const [packedSet, setPackedSet] = useState(new Set())
  const [search, setSearch] = useState('')
  const [imgErr, setImgErr] = useState(new Set())
  const [catLoaded, setCatLoaded] = useState(false)
  const [catSource, setCatSource] = useState('')
  const invRef = useRef(null), catRef = useRef(null)

  useEffect(() => { fetch('/catalog.json').then(r=>r.json()).then(d=>{setCatalog(d);setCatLoaded(true);setCatSource('auto')}).catch(()=>setCatLoaded(true)) }, [])

  const matched = items.map(item => ({ ...item, match: catalog.length > 0 ? findMatch(item.name, catalog) : null }))

  // VIEW 1: Consolidated products
  const consolidated = (() => {
    const map = new Map()
    matched.forEach(item => {
      const key = item.match ? item.match.n : item.name
      if (map.has(key)) { const e = map.get(key); e.totalQty += item.qty; e.invoices.push(item.invoiceNo) }
      else map.set(key, { key, name: item.name, match: item.match, totalQty: item.qty, price: item.price, invoices: [item.invoiceNo] })
    })
    return [...map.values()]
  })()

  // VIEW 2: Invoice groups
  const invoiceGroups = (() => {
    const map = new Map()
    matched.forEach(item => {
      if (!map.has(item.invoiceNo)) map.set(item.invoiceNo, { invoiceNo: item.invoiceNo, customer: item.customer, city: item.city, items: [], total: 0 })
      const g = map.get(item.invoiceNo); g.items.push(item); g.total += item.qty * item.price
    })
    return [...map.values()]
  })()

  const loadDemo = () => { setItems(DEMO); setPickedSet(new Set()); setPackedSet(new Set()); setView('pick') }
  const handleInvoice = (file) => {
    if (!file) return
    if (file.name.endsWith('.pdf')) { alert('PDF parsing coming soon! Use CSV or Load Demo.'); return }
    const r = new FileReader()
    r.onload = (e) => { const p = parseInvoiceCSV(e.target.result); if (p.length) { setItems(p); setPickedSet(new Set()); setPackedSet(new Set()) } }
    r.readAsText(file)
  }
  const handleCatalog = (file) => {
    if (!file) return
    const r = new FileReader()
    r.onload = (e) => {
      const lines = e.target.result.split('\n'); if (lines.length < 2) return
      const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\r/g, '')); const rows = []
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; const vals = parseLine(lines[i]); const obj = {}
        headers.forEach((h, j) => { obj[h] = (vals[j] || '').replace(/\r/g, '') })
        const name = obj['name'] || obj['product name'] || ''; if (!name) continue
        rows.push({ n: name, s: obj['sku'] || '', p: parseFloat(obj['price'] || '0'), i: obj['image'] || '', w: obj['weight'] || '', v: obj['vendor'] || '' })
      }
      setCatalog(rows); setCatSource('uploaded')
    }
    r.readAsText(file)
  }

  const togglePick = (k) => setPickedSet(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })
  const togglePack = (inv) => setPackedSet(p => { const n = new Set(p); n.has(inv) ? n.delete(inv) : n.add(inv); return n })

  const totalQty = items.reduce((s, i) => s + i.qty, 0)
  const totalValue = items.reduce((s, i) => s + i.qty * i.price, 0)
  const invCount = [...new Set(items.map(i => i.invoiceNo))].length
  const prodCount = consolidated.length

  const filtProd = consolidated.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.match?.s||'').toLowerCase().includes(search.toLowerCase()) || (p.match?.v||'').toLowerCase().includes(search.toLowerCase()))
  const filtInv = invoiceGroups.filter(g => !search || g.invoiceNo.includes(search) || g.customer.toLowerCase().includes(search.toLowerCase()) || g.city.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0', fontFamily: "'DM Sans',system-ui,sans-serif", color: '#1A1A1A' }}>
      {/* HEADER */}
      <header style={{ background: 'linear-gradient(135deg,#1B3A2D,#2D5A3F)', padding: '16px 20px' }}>
        <div style={{ maxWidth: 1260, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍵</div>
            <div><div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>TSOT Pick & Pack</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Fulfillment Dashboard</div></div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {catalog.length > 0 && <span style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '4px 10px', borderRadius: 16, fontSize: 11 }}>📦 {catalog.length} products</span>}
            {items.length > 0 && <span style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '4px 10px', borderRadius: 16, fontSize: 11 }}>📋 {invCount} orders · {totalQty} units</span>}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1260, margin: '0 auto', padding: '20px 16px' }}>
        {/* TABS */}
        <div style={{ display: 'flex', marginBottom: 18, borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E4DB' }}>
          {[
            { k: 'pick', l: '🏪 Pick from Godown', badge: prodCount > 0 ? `${pickedSet.size}/${prodCount}` : null },
            { k: 'pack', l: '📦 Pack by Invoice', badge: invCount > 0 ? `${packedSet.size}/${invCount}` : null },
            { k: 'setup', l: '⚙️ Setup' },
          ].map(t => (
            <button key={t.k} onClick={() => { setView(t.k); setSearch('') }} style={{
              flex: 1, padding: '11px 6px', textAlign: 'center', fontSize: 12, fontWeight: 700,
              background: view === t.k ? '#1B3A2D' : '#fff', color: view === t.k ? '#fff' : '#888', border: 'none', cursor: 'pointer'
            }}>{t.l}{t.badge && <span style={{ fontSize: 10, opacity: 0.7 }}> ({t.badge})</span>}</button>
          ))}
        </div>

        {/* ═══ SETUP ═══ */}
        {view === 'setup' && (<>
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1B3A2D', marginBottom: 8 }}>📦 Product Catalog <span style={{ fontSize: 11, color: '#2D5A3F', background: '#E8F5E9', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>{catLoaded ? `✓ ${catalog.length} products ${catSource === 'auto' ? '(auto-loaded)' : '(uploaded)'}` : '⏳ Loading...'}</span></div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Auto-loaded on page load. Upload new CSV only when products change.</p>
            <div onClick={() => catRef.current?.click()} style={{ border: '2px dashed #C8C3B8', borderRadius: 12, padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF7' }}>
              <div style={{ fontSize: 12, color: '#666' }}>📊 Upload updated catalog CSV (optional)</div>
              <input ref={catRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleCatalog(e.target.files[0])} />
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1B3A2D', marginBottom: 8 }}>📄 Daily Invoice</div>
            <div onClick={() => invRef.current?.click()} style={{ border: '2px dashed #C8C3B8', borderRadius: 12, padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF7' }}>
              <div style={{ fontSize: 12, color: '#666' }}>📄 Upload invoice CSV</div>
              <input ref={invRef} type="file" accept=".csv,.txt,.pdf" style={{ display: 'none' }} onChange={e => handleInvoice(e.target.files[0])} />
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#fff', borderRadius: 14 }}>
            <button onClick={loadDemo} style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>📄 Load 30th March Invoices (33 items)</button>
          </div>
        </>)}

        {/* ═══ PICK VIEW ═══ */}
        {view === 'pick' && (<>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>🏪</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1B3A2D', margin: '14px 0 6px' }}>No items to pick</div>
              <button onClick={() => setView('setup')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 12 }}>⚙️ Setup</button>
            </div>
          ) : (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginBottom: 16 }}>
              {[{ n: prodCount, l: 'Products', c: '#1B3A2D' }, { n: totalQty, l: 'Total Units', c: '#1B3A2D' }, { n: pickedSet.size, l: 'Picked', c: '#2D5A3F' }, { n: prodCount - pickedSet.size, l: 'Remaining', c: prodCount - pickedSet.size > 0 ? '#E65100' : '#2D5A3F' }].map((s, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '14px 8px', border: '1px solid #E8E4DB', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.n}</div>
                  <div style={{ fontSize: 9, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              <input type="text" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E8E4DB', fontSize: 12, outline: 'none' }} />
              <button onClick={() => setPickedSet(new Set(consolidated.map(p => p.key)))} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✅ Pick All</button>
              <button onClick={() => setPickedSet(new Set())} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#E8E4DB', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔄 Reset</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 14 }}>
              {filtProd.map(p => {
                const picked = pickedSet.has(p.key), m = p.match, hasImg = m?.i && !imgErr.has(p.key)
                return (
                  <div key={p.key} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: `2px solid ${picked ? '#4CAF50' : '#E8E4DB'}`, opacity: picked ? 0.6 : 1, transform: picked ? 'scale(0.97)' : 'scale(1)', transition: 'all 0.2s' }}>
                    <div style={{ position: 'relative', height: 180, background: '#F0EDE6', overflow: 'hidden' }}>
                      {hasImg ? <img src={m.i} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(pr => new Set(pr).add(p.key))} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 36, opacity: 0.3 }}>🍵</span></div>}
                      {picked && <div style={{ position: 'absolute', inset: 0, background: 'rgba(76,175,80,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 44 }}>✅</span></div>}
                      <div style={{ position: 'absolute', top: 8, right: 8, background: '#E65100', color: '#fff', padding: '5px 14px', borderRadius: 20, fontSize: 15, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>× {p.totalQty}</div>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, lineHeight: 1.3, height: 34, overflow: 'hidden' }}>{p.name}</div>
                      {m && <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{m.s} {m.v && `· ${m.v}`} {m.w && `· ${m.w}`}</div>}
                      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 8 }}>In {[...new Set(p.invoices)].length} order(s): #{[...new Set(p.invoices)].join(', #')}</div>
                      <button onClick={() => togglePick(p.key)} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: picked ? '#E8F5E9' : '#2D5A3F', color: picked ? '#2D5A3F' : '#fff' }}>{picked ? '✅ Picked — Undo' : '🏪 Mark Picked'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
            {pickedSet.size === prodCount && prodCount > 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', marginTop: 18, background: '#E8F5E9', borderRadius: 14 }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#2D5A3F' }}>All {prodCount} products picked!</div>
                <button onClick={() => setView('pack')} style={{ marginTop: 12, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📦 Start Packing Orders →</button>
              </div>
            )}
          </>)}
        </>)}

        {/* ═══ PACK VIEW ═══ */}
        {view === 'pack' && (<>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>📦</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1B3A2D', margin: '14px 0 6px' }}>No invoices loaded</div>
              <button onClick={() => setView('setup')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 12 }}>⚙️ Setup</button>
            </div>
          ) : (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginBottom: 16 }}>
              {[{ n: invCount, l: 'Orders', c: '#1B3A2D' }, { n: `₹${totalValue.toLocaleString('en-IN')}`, l: 'Value', c: '#2D5A3F' }, { n: packedSet.size, l: 'Packed', c: '#2D5A3F' }, { n: invCount - packedSet.size, l: 'Remaining', c: invCount - packedSet.size > 0 ? '#E65100' : '#2D5A3F' }].map((s, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '14px 8px', border: '1px solid #E8E4DB', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.n}</div>
                  <div style={{ fontSize: 9, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              <input type="text" placeholder="🔍 Search invoice, customer, city..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E8E4DB', fontSize: 12, outline: 'none' }} />
              <button onClick={() => setPackedSet(new Set(invoiceGroups.map(g => g.invoiceNo)))} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✅ Pack All</button>
              <button onClick={() => setPackedSet(new Set())} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#E8E4DB', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔄 Reset</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filtInv.map(g => {
                const packed = packedSet.has(g.invoiceNo)
                return (
                  <div key={g.invoiceNo} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: `2px solid ${packed ? '#4CAF50' : '#E8E4DB'}`, opacity: packed ? 0.65 : 1, transition: 'all 0.2s' }}>
                    <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F0EDE6', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#1B3A2D' }}>#{g.invoiceNo}</span>
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 12 }}>{g.customer} · {g.city}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#1B3A2D' }}>₹{g.total.toLocaleString('en-IN')}</span>
                        <span style={{ fontSize: 11, color: '#888', background: '#F5F3EE', padding: '3px 10px', borderRadius: 12 }}>{g.items.length} item{g.items.length > 1 ? 's' : ''}</span>
                        <button onClick={() => togglePack(g.invoiceNo)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: packed ? '#E8F5E9' : '#2D5A3F', color: packed ? '#2D5A3F' : '#fff' }}>{packed ? '✅ Packed' : '📦 Pack'}</button>
                      </div>
                    </div>
                    <div style={{ padding: '12px 18px', display: 'flex', gap: 12, overflowX: 'auto' }}>
                      {g.items.map((item, j) => {
                        const m = item.match, hasImg = m?.i && !imgErr.has(`inv-${g.invoiceNo}-${j}`)
                        return (
                          <div key={j} style={{ minWidth: 180, maxWidth: 220, background: '#FAFAF7', borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E4DB', flexShrink: 0 }}>
                            <div style={{ height: 120, background: '#F0EDE6', position: 'relative', overflow: 'hidden' }}>
                              {hasImg ? <img src={m.i} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(p => new Set(p).add(`inv-${g.invoiceNo}-${j}`))} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 28, opacity: 0.4 }}>🍵</span></div>}
                              <div style={{ position: 'absolute', top: 6, right: 6, background: '#E65100', color: '#fff', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>× {item.qty}</div>
                            </div>
                            <div style={{ padding: '8px 10px' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3, height: 28, overflow: 'hidden' }}>{item.name}</div>
                              {m && <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{m.s} · {m.v}</div>}
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#1B3A2D', marginTop: 4 }}>₹{(item.qty * item.price).toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            {packedSet.size === invCount && invCount > 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', marginTop: 18, background: '#E8F5E9', borderRadius: 14 }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#2D5A3F' }}>All {invCount} orders packed & ready to ship!</div>
                <div style={{ fontSize: 12, color: '#4CAF50', marginTop: 4 }}>{totalQty} units · ₹{totalValue.toLocaleString('en-IN')}</div>
              </div>
            )}
          </>)}
        </>)}
      </main>
    </div>
  )
}

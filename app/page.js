'use client'

import { useState, useRef, useCallback } from 'react'

// ─── CSV PARSER (handles quoted fields) ─────────────────────────────────────
function parseLine(line) {
  const result = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else current += ch
  }
  result.push(current.trim())
  return result
}

function parseCatalogCSV(text) {
  const lines = text.split('\n')
  if (lines.length < 2) return []
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\r/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = parseLine(lines[i])
    const obj = {}
    headers.forEach((h, j) => { obj[h] = (vals[j] || '').replace(/\r/g, '') })
    const name = obj['name'] || obj['product name'] || obj['title'] || ''
    if (!name) continue
    rows.push({
      name,
      sku: obj['sku'] || '',
      price: parseFloat(obj['price'] || '0'),
      image: obj['image'] || obj['image_url'] || '',
      category: obj['category'] || '',
      weight: obj['weight'] || '',
      vendor: obj['vendor'] || '',
      url: obj['url'] || '',
    })
  }
  return rows
}

function parseInvoiceCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\r/g, ''))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',').map(v => v.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/\r/g, '') })
    return {
      name: obj['name'] || obj['product name'] || obj['item'] || '',
      qty: parseInt(obj['qty'] || obj['quantity'] || '1'),
      price: parseFloat(obj['price'] || obj['amount'] || '0'),
      invoiceNo: obj['invoice'] || obj['invoice_no'] || obj['invoice no'] || 'N/A',
      customer: obj['customer'] || '',
      city: obj['city'] || '',
    }
  }).filter(i => i.name)
}

// ─── FUZZY MATCH ────────────────────────────────────────────────────────────
function fuzzyMatch(a, b) {
  const na = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const nb = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (na === nb) return 1
  if (nb.includes(na) || na.includes(nb)) return 0.9
  const wa = na.split(' ').filter(w => w.length > 2)
  const wb = nb.split(' ').filter(w => w.length > 2)
  const common = wa.filter(w => wb.some(x => x.includes(w) || w.includes(x))).length
  return common / Math.max(wa.length, 1)
}

function findBestMatch(itemName, catalog) {
  let best = null, bestScore = 0
  for (const p of catalog) {
    const score = fuzzyMatch(itemName, p.name)
    if (score > bestScore) { bestScore = score; best = p }
  }
  return bestScore >= 0.35 ? { ...best, matchScore: bestScore } : null
}

// ─── REAL INVOICE DATA (from uploaded 27-page PDF) ──────────────────────────
const REAL_INVOICES = [
  { name: "Assam Heritage Black Tea by Deroi Tea | 100% Natural Unblended – 100 g", qty: 1, price: 349, invoiceNo: "3439", customer: "Gajender Rao", city: "Bangalore" },
  { name: "Organic T-Tales Organic English Breakfast Assam Black Tea – Strong Morning Brew – Tea Bags – 25 Tea Bags", qty: 1, price: 200, invoiceNo: "3439", customer: "Gajender Rao", city: "Bangalore" },
  { name: "Chamraj Peppermint Infusion – 25 Tea Bags – Pack of 2", qty: 1, price: 250, invoiceNo: "3444", customer: "Apshra Poonia", city: "New Delhi" },
  { name: "Nilgiri CTC Tea Pack of 2 – Premium Strong Black Leaf Tea – 2 box of 250 g each", qty: 1, price: 250, invoiceNo: "3445", customer: "Surendra Badoni", city: "New Delhi" },
  { name: "STG Darjeeling Premium Black Tea – 100 g", qty: 2, price: 250, invoiceNo: "3451", customer: "Devashri Gawde", city: "Mumbai" },
  { name: "Lluvia Tea Spearmint Green Tea – Crafted for Hormonal Balance – 50 g", qty: 1, price: 399, invoiceNo: "3453", customer: "P sanjuna P", city: "Bangalore" },
  { name: "Korakundah Organic Chamomile Decaf Green Tea – Pack of 2 25 Tea Bags", qty: 2, price: 300, invoiceNo: "3455", customer: "Aravind S", city: "Bengaluru" },
  { name: "Korakundah Organic Chamomile Decaf Green Tea – Pack of 2 25 Tea Bags", qty: 1, price: 300, invoiceNo: "3455", customer: "Aravind S", city: "Bengaluru" },
  { name: "Korakundah Organic Camomile Herbal Infusion Tea Bags – Pack of 2", qty: 1, price: 300, invoiceNo: "3459", customer: "kumti Imchen", city: "Dimapur" },
  { name: "Chamraj Fruit Infusion Tea Bags – Raspberry, Peach, Strawberry & Black Currant – 40 Tea Bags", qty: 1, price: 320, invoiceNo: "3459", customer: "kumti Imchen", city: "Dimapur" },
  { name: "Bagicha by Jayshree Tea Aromatic Jasmine Green Tea Bags – Pack of 2", qty: 1, price: 420, invoiceNo: "3468", customer: "Amarjit Shaheer", city: "Delhi" },
  { name: "Wah Tea Blueberry Blossom Green Tea – Fruity Floral Blend – 50 g", qty: 1, price: 250, invoiceNo: "3460", customer: "Saryu Saini", city: "Ghaziabad" },
  { name: "Wah Blue Lagoon Green Tea – A Vibrant Fusion of Blue Pea Flower & Ginger – 50 g", qty: 1, price: 250, invoiceNo: "3460", customer: "Saryu Saini", city: "Ghaziabad" },
  { name: "Golden Tips Green Blush Rose Green Tea – 100 g", qty: 1, price: 270, invoiceNo: "3471", customer: "Jeeva S", city: "Chennai" },
  { name: "Organic T-Tales Organic Chamomile Green Tea – Dreamy Sleep Infusion – Tea Bags – 25 Tea Bags", qty: 2, price: 220, invoiceNo: "3472", customer: "Udita Singh", city: "Udaipur" },
  { name: "Glendale 100% Natural Lemon Green Tea | Pack Of 2 | High Grown Nilgiri Tea – Pack of 2 100 g Each", qty: 1, price: 300, invoiceNo: "3476", customer: "Pamela Clarke", city: "Ootacamund" },
  { name: "Arunika Assam Orthodox Black Tea – Handrolled Tippy Golden Flowery Orange Pekoe – 100 g", qty: 1, price: 335, invoiceNo: "3477", customer: "Souryyendra Choudhury", city: "Kolkata" },
  { name: "Dabri Assam Orthodox Black Tea – Majherdabri Tea Estate – 100 g", qty: 1, price: 150, invoiceNo: "3477", customer: "Souryyendra Choudhury", city: "Kolkata" },
  { name: "Bagicha By Jayshree Tea Roasted Aromatic Darjeeling Tea – Pack of 2 100 g each", qty: 1, price: 220, invoiceNo: "3479", customer: "M Mukhopadhyay", city: "Gurgaon" },
  { name: "Chamraj Green Tea Bags – Finest Nilgiri Tea – Value Pack of 2 – Pack of 2 25 Tea Bags Each", qty: 1, price: 200, invoiceNo: "3481", customer: "Dhritimedha Das", city: "Silchar" },
  { name: "Chamraj Green Tea Bags – Finest Nilgiri Tea – Value Pack of 2 – Pack of 2 25 Tea Bags Each", qty: 1, price: 200, invoiceNo: "3488", customer: "R P Verma", city: "Jammu" },
  { name: "Gopaldhara Darjeeling First Flush Flowery Broken Orange Pekoe Black Tea – 400 g", qty: 1, price: 495, invoiceNo: "3492", customer: "Anjan Mukhopadhyay", city: "Vadodara" },
  { name: "Lluvia Tea Spearmint Green Tea – Crafted for Hormonal Balance – 50 g", qty: 1, price: 399, invoiceNo: "3493", customer: "Barnamala Roy", city: "Kolkata" },
  { name: "STG Darjeeling Premium First Flush Tea – Pack of 2 – 50 g Each", qty: 1, price: 400, invoiceNo: "3495", customer: "Shyamal Ghosh", city: "Howrah" },
  { name: "Himalayan Brew Kangra Pure Himalayan Detox Kahwa Green Tea – Pack of 2 – 25 Tea Bags X 2", qty: 1, price: 460, invoiceNo: "3502", customer: "Kapil Dev", city: "Jalandhar" },
  { name: "Lavender & Rhododendron Herbal Infusion – The Purple Himalayas – 25 g", qty: 1, price: 350, invoiceNo: "3498", customer: "kavya g", city: "Bangalore" },
  { name: "Oh Cha Afternoon Boost Green Tea with Peppermint, Nettle and Rose – 50 g", qty: 1, price: 300, invoiceNo: "3498", customer: "kavya g", city: "Bangalore" },
  { name: "House of Tumsong Darjeeling First Flush Golden Brew Organic Tea – 100 g", qty: 1, price: 999, invoiceNo: "3503", customer: "Malay Chakraborty", city: "Barrackpore" },
  { name: "Golden Tips Roseherb Green Tea – A Soothing Green Tea with Himalayan Herbs – 100 g", qty: 1, price: 445, invoiceNo: "3504", customer: "PRATIP BASU", city: "Bangalore" },
  { name: "Himalayan Brew Blooming Flower White Tea with Peony, Marigold, Rose, Jasmine and Lavender – Bouquet of Flavours – 2", qty: 1, price: 300, invoiceNo: "3508", customer: "Neha Kohli", city: "Ghaziabad" },
  { name: "STG Darjeeling Premium First Flush Tea – Pack of 2 – 50 g Each", qty: 1, price: 400, invoiceNo: "3509", customer: "priti kodikal", city: "Bangalore" },
  { name: "Golden Tips Earl Grey Black Tea in Royal Brocade Cloth Bag – 100 g", qty: 1, price: 340, invoiceNo: "3510", customer: "KISHAN PRASAD PALAYPU", city: "Hyderabad" },
  { name: "Gopaldhara Darjeeling Premium Second Flush Black Tea Pyramid Leaf Tea Bag – 40 Pyramid Leaf Tea Bag", qty: 1, price: 615, invoiceNo: "3522", customer: "Jayashree Shenoy", city: "Mumbai" },
]

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function Home() {
  const [catalog, setCatalog] = useState([])
  const [matchedItems, setMatchedItems] = useState([])
  const [packedSet, setPackedSet] = useState(new Set())
  const [activeTab, setActiveTab] = useState('dashboard')
  const [filter, setFilter] = useState('all')
  const [catalogFile, setCatalogFile] = useState('')
  const [invoiceFile, setInvoiceFile] = useState('')
  const [search, setSearch] = useState('')
  const [imgErrors, setImgErrors] = useState(new Set())

  const catRef = useRef(null)
  const invRef = useRef(null)

  const matchItems = useCallback((items, cat) => {
    setMatchedItems(items.map(item => ({ ...item, match: findBestMatch(item.name, cat) })))
    setPackedSet(new Set())
    setFilter('all')
  }, [])

  const handleCatalog = (file) => {
    if (!file) return
    setCatalogFile(file.name)
    const r = new FileReader()
    r.onload = (e) => {
      const parsed = parseCatalogCSV(e.target.result)
      setCatalog(parsed)
      if (matchedItems.length > 0) {
        const items = matchedItems.map(m => ({ name: m.name, qty: m.qty, price: m.price, invoiceNo: m.invoiceNo, customer: m.customer, city: m.city }))
        matchItems(items, parsed)
      }
    }
    r.readAsText(file)
  }

  const handleInvoice = (file) => {
    if (!file) return
    setInvoiceFile(file.name)
    if (file.name.endsWith('.pdf')) {
      alert('PDF uploaded! In the next version, this will auto-parse using AI.\n\nFor now, use "Load Real Invoice Data" button or upload a CSV.')
      return
    }
    const r = new FileReader()
    r.onload = (e) => {
      const items = parseInvoiceCSV(e.target.result)
      if (items.length > 0 && catalog.length > 0) matchItems(items, catalog)
      else if (items.length > 0) setMatchedItems(items.map(i => ({ ...i, match: null })))
    }
    r.readAsText(file)
  }

  const loadDemo = () => {
    if (catalog.length > 0) matchItems(REAL_INVOICES, catalog)
    else setMatchedItems(REAL_INVOICES.map(i => ({ ...i, match: null })))
    setInvoiceFile('Invoice_Amazon_30th_March.pdf')
    setActiveTab('dashboard')
  }

  const toggle = (i) => setPackedSet(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })
  const packAll = () => setPackedSet(new Set(matchedItems.map((_, i) => i)))
  const reset = () => { setMatchedItems([]); setPackedSet(new Set()); setInvoiceFile('') }

  const filtered = matchedItems.filter((item, idx) => {
    const f = filter === 'all' || (filter === 'packed' ? packedSet.has(idx) : !packedSet.has(idx))
    const s = !search || item.name.toLowerCase().includes(search.toLowerCase()) || (item.match?.sku || '').toLowerCase().includes(search.toLowerCase()) || (item.customer || '').toLowerCase().includes(search.toLowerCase())
    return f && s
  })

  const total = matchedItems.length
  const packed = packedSet.size
  const pending = total - packed
  const qty = matchedItems.reduce((s, i) => s + i.qty, 0)
  const value = matchedItems.reduce((s, i) => s + i.qty * i.price, 0)
  const invoices = [...new Set(matchedItems.map(i => i.invoiceNo))].length
  const matched = matchedItems.filter(i => i.match).length
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* HEADER */}
      <header style={{ background: 'linear-gradient(135deg, #1B3A2D, #2D5A3F)', padding: '18px 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍵</div>
            <div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>TSOT Pick & Pack</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>The Secret of Tea — Fulfillment Dashboard</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {catalog.length > 0 && <span style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '4px 10px', borderRadius: 16, fontSize: 11 }}>📦 {catalog.length} products</span>}
            {total > 0 && <span style={{ background: packed === total ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.12)', color: '#fff', padding: '4px 10px', borderRadius: 16, fontSize: 11 }}>{packed === total ? '✅' : '📋'} {packed}/{total} packed</span>}
          </div>
        </div>
        {total > 0 && (
          <div style={{ maxWidth: 1200, margin: '12px auto 0', background: 'rgba(255,255,255,0.1)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#4CAF50' : '#81C784', borderRadius: 6, transition: 'width 0.4s' }} />
          </div>
        )}
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
        {/* TABS */}
        <div style={{ display: 'flex', marginBottom: 18, borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E4DB' }}>
          {[{ k: 'dashboard', l: '📋 Pick List' }, { k: 'setup', l: '⚙️ Setup' }].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)} style={{ flex: 1, padding: 11, textAlign: 'center', fontSize: 13, fontWeight: 700, background: activeTab === t.k ? '#1B3A2D' : '#fff', color: activeTab === t.k ? '#fff' : '#888', border: 'none' }}>{t.l}</button>
          ))}
        </div>

        {/* SETUP */}
        {activeTab === 'setup' && (
          <>
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1B3A2D', marginBottom: 10 }}>
                Step 1: Product Catalog
                {catalogFile && <span style={{ fontSize: 11, color: '#2D5A3F', background: '#E8F5E9', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>✓ {catalogFile}</span>}
              </div>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>Upload <code style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>tsot_product_catalog.csv</code></p>
              <div onClick={() => catRef.current?.click()} style={{ border: '2px dashed #C8C3B8', borderRadius: 12, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF7' }}>
                <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.4 }}>📊</div>
                <div style={{ fontSize: 12, color: '#666' }}>Drop catalog CSV or click to browse</div>
                <input ref={catRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleCatalog(e.target.files[0])} />
              </div>
              {catalog.length > 0 && <div style={{ marginTop: 12, padding: 10, background: '#F5FAF7', borderRadius: 8, fontSize: 12 }}>✅ <b>{catalog.length} products</b> loaded with images</div>}
            </div>

            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1B3A2D', marginBottom: 10 }}>
                Step 2: Daily Invoice
                {invoiceFile && <span style={{ fontSize: 11, color: '#2D5A3F', background: '#E8F5E9', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>✓ {invoiceFile}</span>}
              </div>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>Upload invoice CSV (PDF parsing coming soon)</p>
              <div onClick={() => invRef.current?.click()} style={{ border: '2px dashed #C8C3B8', borderRadius: 12, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF7' }}>
                <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.4 }}>📄</div>
                <div style={{ fontSize: 12, color: '#666' }}>Drop invoice CSV or click to browse</div>
                <input ref={invRef} type="file" accept=".csv,.txt,.pdf" style={{ display: 'none' }} onChange={e => handleInvoice(e.target.files[0])} />
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: 16, background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>Or load pre-extracted data from 30th March invoices (33 items, 27 orders)</p>
              <button onClick={loadDemo} style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 14, fontWeight: 700 }}>📄 Load Real Invoice Data</button>
              {catalog.length === 0 && <p style={{ fontSize: 10, color: '#E65100', marginTop: 8 }}>⚠️ Upload catalog first for image matching</p>}
            </div>
          </>
        )}

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <>
            {total === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.3 }}>📦</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1B3A2D', marginBottom: 6 }}>No items to pick yet</div>
                <div style={{ fontSize: 13, color: '#999', marginBottom: 18 }}>Upload catalog + invoice in <b>Setup</b></div>
                <button onClick={() => setActiveTab('setup')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 13, fontWeight: 700 }}>⚙️ Go to Setup</button>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {[
                    { n: invoices, l: 'Invoices', c: '#1B3A2D' },
                    { n: total, l: 'Items', c: '#1B3A2D' },
                    { n: qty, l: 'Units', c: '#1B3A2D' },
                    { n: `₹${value.toLocaleString('en-IN')}`, l: 'Value', c: '#2D5A3F' },
                    { n: pending, l: 'Pending', c: pending > 0 ? '#E65100' : '#2D5A3F' },
                    { n: `${matched}/${total}`, l: 'Matched', c: matched === total ? '#2D5A3F' : '#F9A825' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '12px 8px', border: '1px solid #E8E4DB', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.n}</div>
                      <div style={{ fontSize: 9, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <input type="text" placeholder="🔍 Search product, SKU, customer..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E8E4DB', fontSize: 12, outline: 'none' }} />
                  <button onClick={packAll} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 11, fontWeight: 700 }}>✅ All Packed</button>
                  <button onClick={reset} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#E8E4DB', fontSize: 11, fontWeight: 700 }}>🔄 Reset</button>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[{ k: 'all', l: `All (${total})` }, { k: 'pending', l: `Pending (${pending})` }, { k: 'packed', l: `Packed (${packed})` }].map(f => (
                    <button key={f.k} onClick={() => setFilter(f.k)} style={{
                      padding: '5px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                      background: filter === f.k ? '#1B3A2D' : '#fff', color: filter === f.k ? '#fff' : '#666',
                      border: `1.5px solid ${filter === f.k ? '#1B3A2D' : '#E8E4DB'}`
                    }}>{f.l}</button>
                  ))}
                </div>

                {/* CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                  {filtered.map((item) => {
                    const idx = matchedItems.indexOf(item)
                    const isPacked = packedSet.has(idx)
                    const m = item.match
                    const hasImg = m?.image && !imgErrors.has(idx)

                    return (
                      <div key={idx} style={{
                        background: '#fff', borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s',
                        border: `2px solid ${isPacked ? '#4CAF50' : m ? '#E8E4DB' : '#FFE082'}`,
                        opacity: isPacked ? 0.65 : 1, transform: isPacked ? 'scale(0.97)' : 'scale(1)',
                      }}>
                        <div style={{ position: 'relative', height: 180, background: '#F0EDE6', overflow: 'hidden' }}>
                          {hasImg ? (
                            <img src={m.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErrors(p => new Set(p).add(idx))} />
                          ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
                              <span style={{ fontSize: 40, marginBottom: 4 }}>🍵</span>
                              <span style={{ fontSize: 10 }}>{m ? 'Image loading...' : 'No catalog match'}</span>
                            </div>
                          )}
                          {isPacked && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(76,175,80,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 40 }}>✅</span>
                            </div>
                          )}
                          <div style={{ position: 'absolute', top: 8, right: 8, background: '#E65100', color: '#fff', padding: '4px 12px', borderRadius: 16, fontSize: 13, fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>× {item.qty}</div>
                          {!m && <div style={{ position: 'absolute', top: 8, left: 8, background: '#F9A825', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700 }}>NO MATCH</div>}
                          {m && m.matchScore < 0.7 && <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.5)', color: '#FFE082', padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700 }}>{Math.round(m.matchScore * 100)}%</div>}
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3, lineHeight: 1.3, height: 32, overflow: 'hidden' }}>{item.name}</div>
                          {m && <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>{m.sku} {m.vendor && `· ${m.vendor}`} {m.weight && `· ${m.weight}`}</div>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#E65100', fontWeight: 700 }}>Qty: {item.qty}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#1B3A2D' }}>₹{(item.qty * item.price).toLocaleString('en-IN')}</span>
                          </div>
                          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 8 }}>#{item.invoiceNo} · {item.customer} · {item.city}</div>
                          <button onClick={() => toggle(idx)} style={{
                            width: '100%', padding: 9, borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12,
                            background: isPacked ? '#E8F5E9' : '#2D5A3F', color: isPacked ? '#2D5A3F' : '#fff',
                          }}>{isPacked ? '✅ Packed — Undo' : '📦 Mark Packed'}</button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#999', fontSize: 13 }}>No items match.</div>}

                {packed === total && total > 0 && (
                  <div style={{ textAlign: 'center', padding: '30px 20px', marginTop: 18, background: '#E8F5E9', borderRadius: 14 }}>
                    <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#2D5A3F' }}>All {total} items packed!</div>
                    <div style={{ fontSize: 12, color: '#4CAF50', marginTop: 4 }}>{invoices} invoices · {qty} units · ₹{value.toLocaleString('en-IN')}</div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'

// ─── CSV PARSER ─────────────────────────────────────────────────────────────
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
    rows.push({ name, sku: obj['sku'] || '', price: parseFloat(obj['price'] || '0'), image: obj['image'] || obj['image_url'] || '', category: obj['category'] || '', weight: obj['weight'] || '', vendor: obj['vendor'] || '', url: obj['url'] || '' })
  }
  return rows
}

function parseInvoiceCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\r/g, ''))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseLine(line).map(v => v.replace(/\r/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/\r/g, '') })
    const rawQty = parseInt(obj['qty'] || obj['quantity'] || '1'); const rawPrice = parseFloat(obj['price'] || obj['amount'] || obj['rate'] || '0')
    return { name: obj['name'] || obj['product name'] || obj['item'] || '', qty: isNaN(rawQty) ? 1 : rawQty, price: isNaN(rawPrice) ? 0 : rawPrice, invoiceNo: obj['invoice'] || obj['invoice_no'] || obj['invoice no'] || obj['invoice number'] || 'N/A', customer: obj['customer'] || obj['buyer'] || '', city: obj['city'] || obj['place'] || '' }
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

// ─── REAL INVOICE DATA ──────────────────────────────────────────────────────
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

const CATALOG_KEY = 'tsot_catalog_v1'

export default function Home() {
  const [catalog, setCatalog] = useState([])
  const [matchedItems, setMatchedItems] = useState([])
  const [pickedSet, setPickedSet] = useState(new Set())
  const [packedInvoices, setPackedInvoices] = useState(new Set())
  const [activeTab, setActiveTab] = useState('pick')
  const [search, setSearch] = useState('')
  const [catalogFile, setCatalogFile] = useState('')
  const [invoiceFile, setInvoiceFile] = useState('')
  const [pickFilter, setPickFilter] = useState('all')
  const [packFilter, setPackFilter] = useState('all')
  const [imgErrors, setImgErrors] = useState(new Set())
  const [catalogLoaded, setCatalogLoaded] = useState(false)

  const catRef = useRef(null)
  const invRef = useRef(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CATALOG_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.length > 0) {
          setCatalog(parsed)
          setCatalogFile(`Saved catalog (${parsed.length} products)`)
          setCatalogLoaded(true)
        }
      }
    } catch (e) {}
  }, [])

  const matchItems = (items, cat) => {
    setMatchedItems(items.map(item => ({ ...item, match: findBestMatch(item.name, cat) })))
    setPickedSet(new Set())
    setPackedInvoices(new Set())
  }

  const handleCatalog = (file) => {
    if (!file) return
    setCatalogFile(file.name)
    const r = new FileReader()
    r.onload = (e) => {
      const parsed = parseCatalogCSV(e.target.result)
      setCatalog(parsed)
      setCatalogLoaded(true)
      try { localStorage.setItem(CATALOG_KEY, JSON.stringify(parsed)) } catch (e) {}
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
    if (file.name.endsWith('.pdf')) { alert('PDF parsing coming soon! Use CSV or Load Real Invoice Data.'); return }
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
    setInvoiceFile('Invoice_30th_March.pdf')
    setActiveTab('pick')
  }

  const clearCatalog = () => {
    try { localStorage.removeItem(CATALOG_KEY) } catch (e) {}
    setCatalog([]); setCatalogFile(''); setCatalogLoaded(false)
  }

  // Unique products for Pick view
  const uniqueProducts = (() => {
    const map = new Map()
    matchedItems.forEach((item) => {
      const key = item.name
      if (map.has(key)) { const e = map.get(key); e.totalQty += (item.qty || 0); e.invoiceNos.add(item.invoiceNo) }
      else map.set(key, { name: item.name, match: item.match, totalQty: (item.qty || 0), price: (item.price || 0), invoiceNos: new Set([item.invoiceNo]) })
    })
    return Array.from(map.values())
  })()

  const togglePicked = (n) => setPickedSet(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })
  const pickAll = () => setPickedSet(new Set(uniqueProducts.map(p => p.name)))

  const filteredPick = uniqueProducts.filter(p => {
    const f = pickFilter === 'all' || (pickFilter === 'picked' ? pickedSet.has(p.name) : !pickedSet.has(p.name))
    const s = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.match?.sku || '').toLowerCase().includes(search.toLowerCase())
    return f && s
  })

  // Invoice groups for Pack view
  const invoiceGroups = (() => {
    const map = new Map()
    matchedItems.forEach((item) => {
      if (!map.has(item.invoiceNo)) map.set(item.invoiceNo, { invoiceNo: item.invoiceNo, customer: item.customer, city: item.city, items: [] })
      map.get(item.invoiceNo).items.push(item)
    })
    return Array.from(map.values())
  })()

  const togglePacked = (n) => setPackedInvoices(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })
  const packAll = () => setPackedInvoices(new Set(invoiceGroups.map(g => g.invoiceNo)))

  const filteredPack = invoiceGroups.filter(g => {
    const f = packFilter === 'all' || (packFilter === 'packed' ? packedInvoices.has(g.invoiceNo) : !packedInvoices.has(g.invoiceNo))
    const s = !search || g.customer.toLowerCase().includes(search.toLowerCase()) || g.invoiceNo.includes(search)
    return f && s
  })

  const totalItems = matchedItems.length
  const totalQty = matchedItems.reduce((s, i) => s + (i.qty || 0), 0)
  const totalValue = matchedItems.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0)
  const totalInvoices = invoiceGroups.length
  const pickedCount = pickedSet.size
  const packedCount = packedInvoices.size
  const uniqueCount = uniqueProducts.length

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
      <header style={{ background: 'linear-gradient(135deg, #1B3A2D, #2D5A3F)', padding: '16px 20px' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍵</div>
            <div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>TSOT Pick & Pack</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>The Secret of Tea — Fulfillment Dashboard</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {catalog.length > 0 && <span style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '4px 10px', borderRadius: 16, fontSize: 11 }}>📦 {catalog.length} products</span>}
            {totalItems > 0 && <><span style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '4px 10px', borderRadius: 16, fontSize: 11 }}>🛒 {pickedCount}/{uniqueCount} picked</span><span style={{ background: packedCount === totalInvoices && totalInvoices > 0 ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.12)', color: '#fff', padding: '4px 10px', borderRadius: 16, fontSize: 11 }}>📋 {packedCount}/{totalInvoices} packed</span></>}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', marginBottom: 18, borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E4DB' }}>
          {[{ k: 'pick', l: '🏬 Pick from Godown' }, { k: 'pack', l: '📦 Pack by Invoice' }, { k: 'setup', l: '⚙️ Setup' }].map(t => (
            <button key={t.k} onClick={() => { setActiveTab(t.k); setSearch('') }} style={{ flex: 1, padding: '11px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700, background: activeTab === t.k ? '#1B3A2D' : '#fff', color: activeTab === t.k ? '#fff' : '#888', border: 'none', cursor: 'pointer' }}>{t.l}</button>
          ))}
        </div>

        {/* ═══ SETUP ═══ */}
        {activeTab === 'setup' && (
          <>
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1B3A2D' }}>Product Catalog {catalogLoaded && <span style={{ fontSize: 11, color: '#2D5A3F', background: '#E8F5E9', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>✓ {catalog.length} products saved</span>}</div>
                {catalogLoaded && <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => catRef.current?.click()} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E8E4DB', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🔄 Update Catalog</button>
                  <button onClick={clearCatalog} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #ffcdd2', background: '#fff', color: '#c62828', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🗑️ Clear</button>
                </div>}
              </div>
              {!catalogLoaded ? (
                <div onClick={() => catRef.current?.click()} style={{ border: '2px dashed #C8C3B8', borderRadius: 12, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF7' }}>
                  <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.4 }}>📊</div>
                  <div style={{ fontSize: 12, color: '#666' }}>Upload tsot_product_catalog.csv (one-time, saved in browser)</div>
                </div>
              ) : <p style={{ fontSize: 12, color: '#666' }}>Catalog saved in browser. Click "Update Catalog" to refresh.</p>}
              <input ref={catRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleCatalog(e.target.files[0])} />
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1B3A2D', marginBottom: 10 }}>Daily Invoice {invoiceFile && <span style={{ fontSize: 11, color: '#2D5A3F', background: '#E8F5E9', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>✓ {invoiceFile}</span>}</div>
              <div onClick={() => invRef.current?.click()} style={{ border: '2px dashed #C8C3B8', borderRadius: 12, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF7' }}>
                <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.4 }}>📄</div>
                <div style={{ fontSize: 12, color: '#666' }}>Upload invoice CSV (PDF parsing coming soon)</div>
                <input ref={invRef} type="file" accept=".csv,.txt,.pdf" style={{ display: 'none' }} onChange={e => handleInvoice(e.target.files[0])} />
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: '#fff', borderRadius: 14 }}>
              <button onClick={loadDemo} style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>📄 Load 30th March Invoices (33 items)</button>
              {!catalogLoaded && <p style={{ fontSize: 10, color: '#E65100', marginTop: 8 }}>⚠️ Upload catalog first for images</p>}
            </div>
          </>
        )}

        {/* ═══ PICK FROM GODOWN ═══ */}
        {activeTab === 'pick' && (matchedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: 48, opacity: 0.3 }}>🏬</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1B3A2D', margin: '14px 0 6px' }}>No items to pick</div>
            <button onClick={() => setActiveTab('setup')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 12 }}>⚙️ Go to Setup</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
              {[{ n: uniqueCount, l: 'Unique Products' }, { n: totalQty, l: 'Total Units' }, { n: `₹${totalValue.toLocaleString('en-IN')}`, l: 'Value' }, { n: uniqueCount - pickedCount, l: 'To Pick', c: uniqueCount - pickedCount > 0 ? '#E65100' : '#2D5A3F' }, { n: pickedCount, l: 'Picked' }].map((s, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '12px 8px', border: '1px solid #E8E4DB', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.c || '#1B3A2D' }}>{s.n}</div>
                  <div style={{ fontSize: 9, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, height: 8, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ width: `${uniqueCount > 0 ? (pickedCount / uniqueCount * 100) : 0}%`, height: '100%', background: pickedCount === uniqueCount ? '#4CAF50' : '#2D5A3F', borderRadius: 8, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <input type="text" placeholder="🔍 Search product, SKU..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E8E4DB', fontSize: 12, outline: 'none' }} />
              <button onClick={pickAll} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✅ All Picked</button>
              <button onClick={() => setPickedSet(new Set())} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#E8E4DB', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔄 Reset</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {[{ k: 'all', l: `All (${uniqueCount})` }, { k: 'pending', l: `To Pick (${uniqueCount - pickedCount})` }, { k: 'picked', l: `Picked (${pickedCount})` }].map(f => (
                <button key={f.k} onClick={() => setPickFilter(f.k)} style={{ padding: '5px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: pickFilter === f.k ? '#1B3A2D' : '#fff', color: pickFilter === f.k ? '#fff' : '#666', border: `1.5px solid ${pickFilter === f.k ? '#1B3A2D' : '#E8E4DB'}` }}>{f.l}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {filteredPick.map((product, i) => {
                const isPicked = pickedSet.has(product.name)
                const m = product.match
                const hasImg = m?.image && !imgErrors.has(product.name)
                return (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: `2px solid ${isPicked ? '#4CAF50' : '#E8E4DB'}`, opacity: isPicked ? 0.6 : 1, transform: isPicked ? 'scale(0.97)' : 'scale(1)', transition: 'all 0.2s' }}>
                    <div style={{ position: 'relative', height: 170, background: '#F0EDE6', overflow: 'hidden' }}>
                      {hasImg ? <img src={m.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErrors(p => new Set(p).add(product.name))} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🍵</div>}
                      {isPicked && <div style={{ position: 'absolute', inset: 0, background: 'rgba(76,175,80,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 40 }}>✅</span></div>}
                      <div style={{ position: 'absolute', top: 8, right: 8, background: '#E65100', color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 15, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>× {product.totalQty}</div>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, lineHeight: 1.3, height: 32, overflow: 'hidden' }}>{product.name}</div>
                      {m && <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>{m.sku} {m.vendor && `· ${m.vendor}`} {m.weight && `· ${m.weight}`}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#E65100', fontWeight: 800 }}>Total: {product.totalQty} units</span>
                        <span style={{ fontSize: 10, color: '#888' }}>{product.invoiceNos.size} order{product.invoiceNos.size > 1 ? 's' : ''}</span>
                      </div>
                      <button onClick={() => togglePicked(product.name)} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: isPicked ? '#E8F5E9' : '#2D5A3F', color: isPicked ? '#2D5A3F' : '#fff' }}>{isPicked ? '✅ Picked — Undo' : '🏬 Pick from Godown'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
            {pickedCount === uniqueCount && uniqueCount > 0 && (
              <div style={{ textAlign: 'center', padding: '28px 20px', marginTop: 18, background: '#E8F5E9', borderRadius: 14 }}>
                <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#2D5A3F' }}>All {uniqueCount} products picked!</div>
                <button onClick={() => setActiveTab('pack')} style={{ marginTop: 12, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📦 Go to Pack by Invoice →</button>
              </div>
            )}
          </>
        ))}

        {/* ═══ PACK BY INVOICE ═══ */}
        {activeTab === 'pack' && (matchedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: 48, opacity: 0.3 }}>📦</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1B3A2D', margin: '14px 0' }}>No invoices loaded</div>
            <button onClick={() => setActiveTab('setup')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⚙️ Go to Setup</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
              {[{ n: totalInvoices, l: 'Orders' }, { n: totalItems, l: 'Line Items' }, { n: `₹${totalValue.toLocaleString('en-IN')}`, l: 'Value' }, { n: totalInvoices - packedCount, l: 'To Pack', c: totalInvoices - packedCount > 0 ? '#E65100' : '#2D5A3F' }, { n: packedCount, l: 'Packed' }].map((s, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '12px 8px', border: '1px solid #E8E4DB', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.c || '#1B3A2D' }}>{s.n}</div>
                  <div style={{ fontSize: 9, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, height: 8, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ width: `${totalInvoices > 0 ? (packedCount / totalInvoices * 100) : 0}%`, height: '100%', background: packedCount === totalInvoices ? '#4CAF50' : '#2D5A3F', borderRadius: 8, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <input type="text" placeholder="🔍 Search customer, invoice #..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E8E4DB', fontSize: 12, outline: 'none' }} />
              <button onClick={packAll} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#2D5A3F', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✅ All Packed</button>
              <button onClick={() => setPackedInvoices(new Set())} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#E8E4DB', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔄 Reset</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {[{ k: 'all', l: `All (${totalInvoices})` }, { k: 'pending', l: `To Pack (${totalInvoices - packedCount})` }, { k: 'packed', l: `Packed (${packedCount})` }].map(f => (
                <button key={f.k} onClick={() => setPackFilter(f.k)} style={{ padding: '5px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: packFilter === f.k ? '#1B3A2D' : '#fff', color: packFilter === f.k ? '#fff' : '#666', border: `1.5px solid ${packFilter === f.k ? '#1B3A2D' : '#E8E4DB'}` }}>{f.l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredPack.map((group) => {
                const isPacked = packedInvoices.has(group.invoiceNo)
                const orderTotal = group.items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0)
                return (
                  <div key={group.invoiceNo} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: `2px solid ${isPacked ? '#4CAF50' : '#E8E4DB'}`, opacity: isPacked ? 0.65 : 1, transition: 'all 0.2s' }}>
                    <div style={{ padding: '14px 18px', background: isPacked ? '#E8F5E9' : '#FAFAF7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1B3A2D' }}>{isPacked && '✅ '}Invoice #{group.invoiceNo}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{group.customer} · {group.city} · {group.items.length} item{group.items.length > 1 ? 's' : ''} · ₹{orderTotal.toLocaleString('en-IN')}</div>
                      </div>
                      <button onClick={() => togglePacked(group.invoiceNo)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: isPacked ? '#C8E6C9' : '#2D5A3F', color: isPacked ? '#2D5A3F' : '#fff' }}>{isPacked ? '✅ Packed — Undo' : '📦 Mark Packed'}</button>
                    </div>
                    <div style={{ padding: '12px 18px' }}>
                      {group.items.map((item, j) => {
                        const m = item.match
                        const hasImg = m?.image && !imgErrors.has(`inv-${group.invoiceNo}-${j}`)
                        return (
                          <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: j < group.items.length - 1 ? '1px solid #F0EDE6' : 'none' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: '#F0EDE6', flexShrink: 0 }}>
                              {hasImg ? <img src={m.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErrors(p => new Set(p).add(`inv-${group.invoiceNo}-${j}`))} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🍵</div>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                              {m && <div style={{ fontSize: 10, color: '#888' }}>{m.sku} {m.vendor && `· ${m.vendor}`}</div>}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#E65100' }}>× {item.qty}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#1B3A2D' }}>₹{(item.qty * item.price).toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            {packedCount === totalInvoices && totalInvoices > 0 && (
              <div style={{ textAlign: 'center', padding: '28px 20px', marginTop: 18, background: '#E8F5E9', borderRadius: 14 }}>
                <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#2D5A3F' }}>All {totalInvoices} orders packed & ready to ship!</div>
                <div style={{ fontSize: 12, color: '#4CAF50', marginTop: 4 }}>{totalQty} units · ₹{totalValue.toLocaleString('en-IN')}</div>
              </div>
            )}
          </>
        ))}
      </main>
    </div>
  )
}

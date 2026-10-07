import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { BASE_URL } from '@/lib/locations';
import { GUIA_CATEGORIAS, filtrarArtigos } from '@/lib/guia';

export default function GuiaSaudeOcular() {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todos');
  const artigos = filtrarArtigos(busca, categoria);
  return <div className="theme-obsidian min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Guia de Saúde Ocular | Dr. Juliano Machado</title>
      <meta name="description" content="Respostas para dúvidas comuns sobre catarata, glaucoma, olho seco, diabetes, visão embaçada e exames. Conteúdo revisado pelo Dr. Juliano Machado." />
      <link rel="canonical" href={`${BASE_URL}/guia-saude-ocular`} />
      <meta name="robots" content="index, follow" />
      <meta property="og:title" content="Guia de Saúde Ocular | Dr. Juliano Machado" />
      <meta property="og:description" content="Informação para cuidar da visão e se preparar para a consulta oftalmológica." />
      <meta property="og:url" content={`${BASE_URL}/guia-saude-ocular`} />
      <meta property="og:type" content="website" />
      <script type="application/ld+json">{JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:'Guia de Saúde Ocular',url:BASE_URL+'/guia-saude-ocular',inLanguage:'pt-BR'})}</script>
    </Helmet>
    <Header />
    <main id="conteudo" className="container mx-auto max-w-6xl px-5 pt-32 pb-20">
      <Link to="/" className="text-sm text-primary hover:underline">Início</Link>
      <header className="mt-8 mb-10 max-w-3xl">
        <p className="text-primary text-sm font-semibold uppercase tracking-widest">Informação para cuidar da visão</p>
        <h1 className="font-serif text-4xl md:text-5xl mt-3 mb-5">Guia de Saúde Ocular</h1>
        <p className="text-lg text-muted-foreground">Entenda os sintomas, conheça os tratamentos e prepare-se para sua consulta. Conteúdo revisado pelo Dr. Juliano Machado — CRM-PA 15253.</p>
      </header>
      <div className="mb-8 space-y-5">
        <label className="block max-w-lg font-medium">Buscar assunto
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: catarata, diabetes ou exame de vista" className="mt-2 w-full min-h-12 rounded-lg border border-border bg-card px-4 text-foreground focus-visible:outline-primary" />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tema">
          {GUIA_CATEGORIAS.map(c => <button key={c} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(c)} className={`min-h-11 rounded-full border px-4 py-2 text-sm ${categoria === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}>{c}</button>)}
        </div>
        <p className="text-sm text-muted-foreground" role="status">{artigos.length} {artigos.length === 1 ? 'artigo encontrado' : 'artigos encontrados'}</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {artigos.map(a => <Link key={a.slug} to={'/guia/' + a.slug} className="guide-card overflow-hidden rounded-xl border border-border bg-card hover:border-primary transition-colors focus-visible:outline-primary">
          <img src={a.imagem.src} srcSet={a.imagem.srcset.map(v => `${v.src} ${v.largura}w`).join(', ')} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) 46vw, 360px" width={a.imagem.largura} height={a.imagem.altura} alt={a.imagem.alt} loading="lazy" className="w-full aspect-video object-cover" />
          <div className="p-6"><p className="text-xs text-primary uppercase tracking-wider">{a.categoria}</p><h2 className="font-serif text-2xl mt-3 mb-4">{a.titulo}</h2><p className="text-muted-foreground text-sm leading-relaxed">{a.descricao}</p><span className="inline-block mt-5 text-primary font-medium">Ler artigo →</span></div>
        </Link>)}
      </div>
      {!artigos.length && <div className="rounded-xl bg-card border border-border p-8"><p>Nenhum artigo encontrado. Experimente outro assunto.</p><button className="mt-4 text-primary underline min-h-11" onClick={() => {setBusca(''); setCategoria('Todos');}}>Ver todos os artigos</button></div>}
      <p className="text-sm text-muted-foreground mt-10">Este conteúdo é informativo e não substitui uma avaliação oftalmológica. Imagens ilustrativas geradas por IA.</p>
    </main><Footer />
  </div>;
}

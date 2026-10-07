import { useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NotFound from '@/pages/NotFound';
import { BASE_URL } from '@/lib/locations';
import { GUIA_ARTIGOS, tituloRelacionado } from '@/lib/guia';
import { useSiteWhatsApp } from '@/hooks/useSiteWhatsApp';
import { useGoogleTag } from '@/hooks/useGoogleTag';
import { useGuiaReading } from '@/hooks/useGuiaReading';
import { trackGuiaEvent, rememberGuiaSource } from '@/lib/guiaAnalytics';

export default function GuiaArtigo({ slug }: { slug: string }) {
  const artigo = GUIA_ARTIGOS.find(a => a.slug === slug);
  const content = useRef<HTMLDivElement>(null);
  const { waLink } = useSiteWhatsApp();
  const { trackWhatsAppClick } = useGoogleTag();
  useGuiaReading(artigo?.slug ?? '', content);
  if (!artigo) return <NotFound />;
  const a = artigo, url = `${BASE_URL}/guia/${a.slug}`;
  const toc = [...a.html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map(m => ({ id:m[1],title:m[2] }));
  const whatsapp = waLink(undefined, `guia_${a.slug.replace(/-/g, '_')}`);
  const schema = {'@context':'https://schema.org','@graph':[
    {'@type':'MedicalWebPage','@id':url,url,name:a.titulo,inLanguage:'pt-BR',lastReviewed:a.data_revisao,reviewedBy:{'@type':'Physician',name:a.revisao_medica.nome,identifier:a.revisao_medica.crm}},
    {'@type':'Article',headline:a.titulo,description:a.descricao,datePublished:a.data_publicacao,dateModified:a.data_revisao,mainEntityOfPage:url,image:BASE_URL+a.imagem.src,inLanguage:'pt-BR',publisher:{'@type':'Organization',name:'Site Dr. Juliano Machado',url:BASE_URL}},
    {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Início',item:BASE_URL+'/'},{'@type':'ListItem',position:2,name:'Guia de Saúde Ocular',item:BASE_URL+'/guia-saude-ocular'},{'@type':'ListItem',position:3,name:a.titulo,item:url}]}
  ]};
  return <div className="theme-obsidian min-h-screen bg-background text-foreground">
    <Helmet><title>{a.titulo} | Dr. Juliano Machado</title><meta name="description" content={a.descricao} /><link rel="canonical" href={url} /><meta name="robots" content="index, follow" /><meta property="og:title" content={a.titulo} /><meta property="og:description" content={a.descricao} /><meta property="og:url" content={url} /><meta property="og:type" content="article" /><meta property="og:image" content={BASE_URL+a.imagem.src} /><meta property="og:image:alt" content={a.imagem.alt} /><script type="application/ld+json">{JSON.stringify(schema).replace(/</g,'\\u003c')}</script></Helmet>
    <Header /><main id="conteudo" className="container mx-auto max-w-5xl px-5 pt-32 pb-20 ocular-guide">
      <nav aria-label="Você está aqui" className="text-sm text-muted-foreground flex flex-wrap gap-2"><Link to="/" className="hover:underline">Início</Link><span>/</span><Link to="/guia-saude-ocular" className="text-primary hover:underline">Guia de Saúde Ocular</Link></nav>
      <header className="mt-8 mb-8"><p className="text-sm text-primary uppercase tracking-wider">{a.categoria}</p><h1 className="font-serif text-3xl md:text-5xl leading-tight mt-3 mb-5">{a.titulo}</h1><p className="text-lg text-muted-foreground leading-relaxed">{a.descricao}</p><p className="mt-5 text-sm text-muted-foreground">Revisão médica: {a.revisao_medica.nome} — {a.revisao_medica.crm}<br />Publicado em <time dateTime={a.data_publicacao}>{a.data_publicacao.split('-').reverse().join('/')}</time> · Revisado em <time dateTime={a.data_revisao}>{a.data_revisao.split('-').reverse().join('/')}</time></p></header>
      <figure className="mb-10"><img src={a.imagem.src} srcSet={a.imagem.srcset.map(v => `${v.src} ${v.largura}w`).join(', ')} sizes="(max-width: 1023px) calc(100vw - 40px), 984px" alt={a.imagem.alt} width={a.imagem.largura} height={a.imagem.altura} className="w-full rounded-xl aspect-video object-cover" loading="eager" /><figcaption className="text-xs text-muted-foreground mt-2">{a.imagem.legenda}</figcaption></figure>
      <div className="grid lg:grid-cols-[240px_1fr] gap-10">
        <aside><nav aria-label="Neste artigo" className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-28"><h2 className="font-semibold mb-3">Neste artigo</h2><ol className="space-y-3 text-sm">{toc.map(t => <li key={t.id}><a href={'#'+t.id} className="text-muted-foreground hover:text-primary">{t.title}</a></li>)}</ol></nav></aside>
        <article className="min-w-0">
          {/* HTML editorial estático, versionado e revisado; não vem de usuários. */}
          <div ref={content} className="guide-body" dangerouslySetInnerHTML={{__html:a.html}} />
          <section className="mt-10 border-t border-border pt-8"><h2 className="font-serif text-2xl mb-4">Fontes consultadas</h2><ul className="space-y-3 text-sm break-words">{a.fontes.map(f => <li id={'fonte-'+f.id} key={f.id} className="scroll-mt-28"><a href={f.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{f.titulo}</a></li>)}</ul></section>
          <p className="text-sm text-muted-foreground mt-8">Este conteúdo é informativo e não substitui uma avaliação oftalmológica.</p>
          <section className="mt-8"><h2 className="font-serif text-2xl mb-4">Continue sua leitura</h2><ul className="space-y-3">{a.relacionados.map(link => <li key={link}><Link to={link} className="text-primary hover:underline">{tituloRelacionado(link)}</Link></li>)}</ul></section>
          <section className="mt-10 rounded-xl border border-primary/30 bg-card p-6"><h2 className="font-serif text-2xl mb-3">Converse sobre sua visão</h2><p className="text-muted-foreground mb-5">Na consulta, o exame orienta o cuidado para o seu caso.</p><div className="flex flex-wrap gap-3"><Link to="/agendamento" onClick={() => { rememberGuiaSource(a.slug); trackGuiaEvent('ocular_article_schedule_click',a.slug); }} className="inline-flex min-h-12 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">Agendar avaliação</Link><a href={whatsapp} onClick={() => trackWhatsAppClick(whatsapp,'Falar pelo WhatsApp',`guia_${a.slug}`, 'guia_artigo')} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-lg border border-border px-5 text-primary">Falar pelo WhatsApp</a></div></section>
        </article>
      </div>
    </main><Footer />
  </div>;
}

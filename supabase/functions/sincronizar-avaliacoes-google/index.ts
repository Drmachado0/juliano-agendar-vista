import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleReview {
  author_name: string;
  author_url?: string;
  language: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

interface PlaceDetailsResponse {
  result?: {
    reviews?: GoogleReview[];
    user_ratings_total?: number;
    rating?: number;
  };
  status: string;
  error_message?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization (CRON_SECRET for scheduled jobs)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      // Allow admin users via Supabase auth
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader || '' } }
      });
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Unauthorized access attempt');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
        
      if (!roleData) {
        console.error('Non-admin user attempt');
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get Google API credentials
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const placeId = Deno.env.get('GOOGLE_PLACE_ID');

    if (!googleApiKey || !placeId) {
      console.error('Missing Google API credentials');
      return new Response(JSON.stringify({ error: 'Google API credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching reviews from Google Places API...');

    /*
      DUAS CHAMADAS, NAO UMA, desde 29/08/2026.

      A Place Details devolve no maximo 5 avaliacoes por chamada, e quem escolhe
      as 5 e o Google. No padrao reviews_sort=most_relevant ele repete quase
      sempre as mesmas campeas, entao o banco travou em 17 depois de meses de
      cron diario. Pedindo tambem reviews_sort=newest vem o recorte das mais
      recentes, e a uniao das duas rende ate 10 distintas por rodada.

      ISTO NAO BAIXA AS 111. A Places API nao expoe o historico completo, nem na
      versao nova. Quem entrega tudo e a Google Business Profile API, que exige
      OAuth do dono do perfil e allowlist do projeto no Google. Enquanto isso
      nao existir, o unico caminho e o cron acumulando.
    */
    const buildUrl = (sort: 'most_relevant' | 'newest') =>
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,user_ratings_total,rating&reviews_sort=${sort}&key=${googleApiKey}&language=pt-BR`;

    /*
      OS DOIS CORPOS SAO LIDOS ANTES DE QUALQUER RETORNO. Se a checagem de status
      viesse primeiro, o caminho de erro sairia da funcao sem consumir a segunda
      resposta, e o Deno reclamaria de conexao vazando a cada sincronizacao que
      falha.
    */
    const [googleData, newestParsed] = await Promise.all([
      fetch(buildUrl('most_relevant')).then((r) => r.json() as Promise<PlaceDetailsResponse>),
      fetch(buildUrl('newest'))
        .then((r) => r.json() as Promise<PlaceDetailsResponse>)
        .catch((err) => {
          console.warn('Falha ao ler a resposta de reviews_sort=newest:', err);
          return null;
        }),
    ]);

    if (googleData.status !== 'OK') {
      console.error('Google API error:', googleData.status, googleData.error_message);
      return new Response(JSON.stringify({
        error: 'Google API error',
        details: googleData.error_message || googleData.status
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    /*
      A SEGUNDA CHAMADA E COMPLEMENTAR e nunca derruba a sincronizacao. Se o
      Google recusar reviews_sort=newest, ou mudar o parametro um dia, a funcao
      segue com o resultado da primeira em vez de falhar inteira.
    */
    let newestReviews: GoogleReview[] = [];
    if (newestParsed && newestParsed.status === 'OK') {
      newestReviews = newestParsed.result?.reviews ?? [];
    } else if (newestParsed) {
      console.warn('reviews_sort=newest respondeu', newestParsed.status, newestParsed.error_message);
    }

    /*
      A CHAVE DO MAPA E O google_review_id, e nao uma chave qualquer. O upsert
      mais abaixo itera este mesmo mapa e usa a chave direto, entao a formula da
      identidade existe num lugar so e as duas nao tem como divergir.
    */
    const reviewsById = new Map<string, GoogleReview>();
    for (const review of [...(googleData.result?.reviews ?? []), ...newestReviews]) {
      reviewsById.set(`${review.author_name.replace(/\s+/g, '_')}_${review.time}`, review);
    }
    console.log(
      `Found ${reviewsById.size} reviews from Google (uniao de most_relevant e newest)`,
    );

    // Connect to Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Grava o total REAL de avaliações + nota média do Google em site_config.
    // Alimenta o selo "+N avaliações" e o aggregateRating do site (sempre verídicos).
    const totalReal = googleData.result?.user_ratings_total ?? null;
    const notaMedia = googleData.result?.rating ?? null;
    if (totalReal !== null) {
      const { error: cfgErr } = await supabaseAdmin
        .from('site_config')
        .update({
          google_reviews_total: totalReal,
          google_rating: notaMedia,
          updated_at: new Date().toISOString(),
        })
        .eq('id', true);
      if (cfgErr) console.error('Erro ao gravar total em site_config:', cfgErr);
    }

    if (reviewsById.size === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No reviews found',
        google_reviews_total: totalReal,
        google_rating: notaMedia,
        synced: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    /*
      UM UPSERT SO, e nao um por avaliacao. O laco anterior fazia uma ida e volta
      ao PostgREST por linha. Com a uniao das duas ordenacoes isso dobrou para
      ate 10 por rodada, todas equivalentes a uma unica chamada com array.

      A CHAVE VEM DO MAPA, nao e recalculada aqui.
    */
    const now = new Date().toISOString();
    const rows = [...reviewsById].map(([googleReviewId, review]) => ({
      google_review_id: googleReviewId,
      author_name: review.author_name,
      author_photo_url: review.profile_photo_url || null,
      rating: review.rating,
      text: review.text || null,
      relative_time_description: review.relative_time_description,
      time_epoch: review.time,
      language: review.language,
      ativo: true,
      updated_at: now,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('avaliacoes_google')
      .upsert(rows, {
        onConflict: 'google_review_id',
        ignoreDuplicates: false,
      });

    // Em lote o resultado e tudo ou nada, entao a contagem por linha some junto.
    const syncedCount = upsertError ? 0 : rows.length;
    const errorCount = upsertError ? rows.length : 0;

    if (upsertError) {
      console.error('Error upserting reviews:', upsertError);
    }

    console.log(`Sync complete: ${syncedCount} synced, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Synchronized ${syncedCount} reviews`,
      synced: syncedCount,
      errors: errorCount,
      total_from_google: rows.length,
      google_reviews_total: googleData.result?.user_ratings_total ?? null,
      google_rating: googleData.result?.rating ?? null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sincronizar-avaliacoes-google:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

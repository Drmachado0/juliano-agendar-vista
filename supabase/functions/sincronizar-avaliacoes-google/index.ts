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

    // Fetch reviews from Google Places API
    const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${googleApiKey}&language=pt-BR`;
    
    const googleResponse = await fetch(googleUrl);
    const googleData: PlaceDetailsResponse = await googleResponse.json();

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

    const reviews = googleData.result?.reviews || [];
    console.log(`Found ${reviews.length} reviews from Google`);

    if (reviews.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No reviews found',
        synced: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Connect to Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Process and upsert reviews
    let syncedCount = 0;
    let errorCount = 0;

    for (const review of reviews) {
      // Generate unique ID based on author and timestamp
      const googleReviewId = `${review.author_name.replace(/\s+/g, '_')}_${review.time}`;
      
      const reviewData = {
        google_review_id: googleReviewId,
        author_name: review.author_name,
        author_photo_url: review.profile_photo_url || null,
        rating: review.rating,
        text: review.text || null,
        relative_time_description: review.relative_time_description,
        time_epoch: review.time,
        language: review.language,
        ativo: true,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabaseAdmin
        .from('avaliacoes_google')
        .upsert(reviewData, { 
          onConflict: 'google_review_id',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error('Error upserting review:', googleReviewId, upsertError);
        errorCount++;
      } else {
        console.log('Synced review:', googleReviewId);
        syncedCount++;
      }
    }

    console.log(`Sync complete: ${syncedCount} synced, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Synchronized ${syncedCount} reviews`,
      synced: syncedCount,
      errors: errorCount,
      total_from_google: reviews.length
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

// ============================================================================
// SEND TO COURIER — Supabase Edge Function
// ============================================================================
//
// WHAT THIS FILE IS:
// This runs on Supabase's servers, not in the browser. This is where your
// courier's API key and API call belong — never in admin.html, index.html,
// or any other file that ships to a browser. That's the whole point of
// putting this in an Edge Function.
//
// WHAT'S ALREADY DONE:
// - Receiving the request from the admin panel
// - Loading the full order (customer, address, items, totals) securely
// - Building a clean, generic payload with everything a courier API would
//   plausibly need
// - Saving whatever the courier responds with back into Supabase, so it
//   shows up in the admin panel's order view
//
// WHAT YOU NEED TO ADD (marked clearly below with TODO):
// - The actual courier API endpoint URL
// - The actual request format your courier expects (this varies a lot
//   between couriers — some want flat JSON, some want specific field names,
//   some want XML, etc.)
// - Reading the courier's response into consignment_number / tracking_number
// - Your courier API key, stored as a secret (instructions below)
//
// NOTHING BELOW INVENTS A REAL COURIER ENDPOINT OR CREDENTIALS. Once you
// share your courier's API documentation, this is the exact file to hand
// back for the real integration to be completed.
//
// ============================================================================
// HOW TO DEPLOY THIS (no command line needed):
// 1. Go to your Supabase project dashboard → Edge Functions → Create a new function
// 2. Name it exactly: send-to-courier
// 3. Paste this entire file's contents into the function editor
// 4. Click Deploy
// 5. Go to Edge Functions → send-to-courier → Secrets, and add:
//      COURIER_API_KEY = (your courier's API key, once you have it)
//      COURIER_API_URL = (your courier's API endpoint, once you have it)
//    (SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are all
//    provided automatically by Supabase — you don't need to set those yourself.)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- 0. Verify the caller is actually signed in as an admin ----
    // Without this check, anyone who discovers this function's URL could
    // trigger courier bookings for any order, since the function itself
    // uses the service role key (which bypasses RLS) below.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not signed in' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client — runs with full access, bypassing RLS, since this
    // code only ever runs on Supabase's servers, never in a browser.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ---- 1. Load the order ----
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- 2. Build a generic shipment payload from the order ----
    // This is intentionally courier-agnostic. Map these fields into whatever
    // shape your specific courier's API expects in step 3 below.
    const shipmentPayload = {
      order_id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      delivery_address: order.customer_address,
      city: order.customer_city,
      province: order.customer_province,
      country: order.customer_country,
      items: (order.items || []).map((it) => ({
        name: it.name,
        size: it.size,
        quantity: it.qty,
        unit_price: it.price,
      })),
      order_amount: order.total,
      cod_amount: order.total, // this store is Cash on Delivery only, so COD amount = order total
      // weight_kg: not currently tracked per product. If your courier requires
      // package weight, add a `weight_kg` column to the `products` table and
      // sum it here across order.items.
    };

    // =========================================================================
    // TODO — REPLACE THIS SECTION WITH YOUR COURIER'S REAL API CALL
    // =========================================================================
    //
    // Example shape (DO NOT rely on this exact code — every courier's real
    // request/response format is different; use their docs):
    //
    // const COURIER_API_KEY = Deno.env.get('COURIER_API_KEY');
    // const COURIER_API_URL = Deno.env.get('COURIER_API_URL');
    //
    // const courierRes = await fetch(COURIER_API_URL, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${COURIER_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(shipmentPayload), // reshape to match their format
    // });
    // const courierData = await courierRes.json();
    //
    // if (!courierRes.ok) {
    //   // Save the failed attempt too, so it's visible in the admin panel.
    //   await supabase.from('courier_shipments').insert({
    //     order_id: order.id,
    //     courier_name: 'YOUR_COURIER_NAME',
    //     status: 'failed',
    //     raw_response: courierData,
    //   });
    //   return new Response(JSON.stringify({ error: 'Courier rejected the request', details: courierData }), {
    //     status: 502,
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    //   });
    // }
    //
    // const { error: insertError } = await supabase.from('courier_shipments').insert({
    //   order_id: order.id,
    //   courier_name: 'YOUR_COURIER_NAME',
    //   consignment_number: courierData.consignment_number,   // adjust field name to match their response
    //   tracking_number: courierData.tracking_number,          // adjust field name to match their response
    //   status: 'booked',
    //   raw_response: courierData,
    // });
    //
    // if (insertError) {
    //   return new Response(JSON.stringify({ error: 'Courier booked, but saving the result failed', details: insertError }), {
    //     status: 500,
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    //   });
    // }
    //
    // await supabase.from('orders').update({ shipment_status: 'booked' }).eq('id', order.id);
    //
    // return new Response(JSON.stringify({ success: true, consignment_number: courierData.consignment_number }), {
    //   status: 200,
    //   headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    // });
    //
    // =========================================================================

    // Until the section above is filled in with your real courier, this
    // function intentionally returns a clear "not configured" error instead
    // of pretending to succeed.
    return new Response(
      JSON.stringify({
        error: 'Courier integration not yet configured — see the TODO section in this Edge Function.',
        payload_preview: shipmentPayload,
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

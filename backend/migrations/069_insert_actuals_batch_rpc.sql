-- RPC to insert actuals in bulk with audit trigger disabled (fast import).
-- Used by CSV actuals import. Accepts same record shape as table().insert().
-- Caller sends batches (e.g. 1000–2000 rows per call).
--
-- Run as postgres. GRANT EXECUTE to service_role and anon.

CREATE OR REPLACE FUNCTION public.insert_actuals_batch(records jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int;
BEGIN
  ALTER TABLE public.actuals DISABLE TRIGGER audit_actuals;
  BEGIN
    INSERT INTO public.actuals (
      id, fi_doc_no, posting_date, document_date, vendor, vendor_description,
      project_id, project_nr, wbs_element, amount, currency, item_text, document_type,
      document_type_desc, po_no, po_line_no, vendor_invoice_no, project_description,
      wbs_description, gl_account, gl_account_desc, cost_center, cost_center_desc,
      product_desc, document_header_text, payment_terms, net_due_date, creation_date,
      sap_invoice_no, investment_profile, account_group_level1, account_subgroup_level2,
      account_level3, value_in_document_currency, document_currency_code, quantity,
      personnel_number, po_final_invoice_indicator, value_type, miro_invoice_no,
      goods_received_value, created_at, updated_at, organization_id
    )
    SELECT
      (e->>'id')::uuid,
      e->>'fi_doc_no',
      (e->>'posting_date')::date,
      (e->>'document_date')::date,
      e->>'vendor',
      e->>'vendor_description',
      (e->>'project_id')::uuid,
      e->>'project_nr',
      e->>'wbs_element',
      (e->>'amount')::decimal,
      e->>'currency',
      e->>'item_text',
      e->>'document_type',
      e->>'document_type_desc',
      e->>'po_no',
      (e->>'po_line_no')::int,
      e->>'vendor_invoice_no',
      e->>'project_description',
      e->>'wbs_description',
      e->>'gl_account',
      e->>'gl_account_desc',
      e->>'cost_center',
      e->>'cost_center_desc',
      e->>'product_desc',
      e->>'document_header_text',
      e->>'payment_terms',
      (e->>'net_due_date')::date,
      (e->>'creation_date')::date,
      e->>'sap_invoice_no',
      e->>'investment_profile',
      e->>'account_group_level1',
      e->>'account_subgroup_level2',
      e->>'account_level3',
      (e->>'value_in_document_currency')::decimal,
      e->>'document_currency_code',
      (e->>'quantity')::decimal,
      e->>'personnel_number',
      e->>'po_final_invoice_indicator',
      e->>'value_type',
      e->>'miro_invoice_no',
      (e->>'goods_received_value')::decimal,
      (e->>'created_at')::timestamptz,
      (e->>'updated_at')::timestamptz,
      (e->>'organization_id')::uuid
    FROM jsonb_array_elements(records) AS e;
    GET DIAGNOSTICS inserted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.actuals ENABLE TRIGGER audit_actuals;
    RAISE;
  END;
  ALTER TABLE public.actuals ENABLE TRIGGER audit_actuals;
  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_actuals_batch(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_actuals_batch(jsonb) TO anon;

COMMENT ON FUNCTION public.insert_actuals_batch(jsonb) IS 'Bulk insert actuals with audit trigger disabled. Used by CSV import for speed.';

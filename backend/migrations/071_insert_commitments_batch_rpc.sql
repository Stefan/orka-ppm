-- RPC to insert commitments in bulk with audit trigger disabled (fast import).
-- Used by CSV commitments import. Same pattern as insert_actuals_batch.
-- Run as postgres. GRANT EXECUTE to service_role and anon.

CREATE OR REPLACE FUNCTION public.insert_commitments_batch(records jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int;
BEGIN
  ALTER TABLE public.commitments DISABLE TRIGGER audit_commitments;
  BEGIN
    INSERT INTO public.commitments (
      id, po_number, po_date, vendor, vendor_description, project_id, project_nr,
      wbs_element, po_net_amount, total_amount, currency, po_status, po_line_nr,
      delivery_date, requester, po_created_by, shopping_cart_number, project_description,
      wbs_description, cost_center, cost_center_description, tax_amount, po_line_text,
      document_currency_code, value_in_document_currency, investment_profile,
      account_group_level1, account_subgroup_level2, account_level3, change_date,
      purchase_requisition, procurement_plant, contract_number, joint_commodity_code,
      po_title, version, fi_doc_no, created_at, updated_at, organization_id
    )
    SELECT
      (e->>'id')::uuid,
      e->>'po_number',
      (e->>'po_date')::date,
      e->>'vendor',
      e->>'vendor_description',
      (e->>'project_id')::uuid,
      e->>'project_nr',
      e->>'wbs_element',
      (e->>'po_net_amount')::decimal,
      (e->>'total_amount')::decimal,
      e->>'currency',
      e->>'po_status',
      (e->>'po_line_nr')::int,
      (e->>'delivery_date')::date,
      e->>'requester',
      e->>'po_created_by',
      e->>'shopping_cart_number',
      e->>'project_description',
      e->>'wbs_description',
      e->>'cost_center',
      e->>'cost_center_description',
      (e->>'tax_amount')::decimal,
      e->>'po_line_text',
      e->>'document_currency_code',
      (e->>'value_in_document_currency')::decimal,
      e->>'investment_profile',
      e->>'account_group_level1',
      e->>'account_subgroup_level2',
      e->>'account_level3',
      (e->>'change_date')::date,
      e->>'purchase_requisition',
      e->>'procurement_plant',
      e->>'contract_number',
      e->>'joint_commodity_code',
      e->>'po_title',
      e->>'version',
      e->>'fi_doc_no',
      (e->>'created_at')::timestamptz,
      (e->>'updated_at')::timestamptz,
      (e->>'organization_id')::uuid
    FROM jsonb_array_elements(records) AS e;
    GET DIAGNOSTICS inserted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.commitments ENABLE TRIGGER audit_commitments;
    RAISE;
  END;
  ALTER TABLE public.commitments ENABLE TRIGGER audit_commitments;
  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_commitments_batch(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_commitments_batch(jsonb) TO anon;

COMMENT ON FUNCTION public.insert_commitments_batch(jsonb) IS 'Bulk insert commitments with audit trigger disabled. Used by CSV import for speed.';

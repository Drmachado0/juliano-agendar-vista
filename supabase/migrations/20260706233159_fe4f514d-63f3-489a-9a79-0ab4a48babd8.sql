-- Trigger de auditoria para mudanças no Pixel ID esperado
CREATE OR REPLACE FUNCTION public.log_site_config_pixel_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.expected_meta_pixel_id IS DISTINCT FROM OLD.expected_meta_pixel_id THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.updated_by;

    INSERT INTO public.system_logs (level, category, source, message, details, user_id, user_email)
    VALUES (
      'info',
      'security',
      'admin/auditoria-tracking',
      'Pixel ID esperado alterado',
      jsonb_build_object(
        'field', 'expected_meta_pixel_id',
        'old_value', OLD.expected_meta_pixel_id,
        'new_value', NEW.expected_meta_pixel_id
      ),
      NEW.updated_by,
      v_email
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_site_config_pixel_change ON public.site_config;
CREATE TRIGGER trg_log_site_config_pixel_change
AFTER UPDATE ON public.site_config
FOR EACH ROW
EXECUTE FUNCTION public.log_site_config_pixel_change();
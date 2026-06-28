DO $$
DECLARE
  r RECORD;
  new_qual text;
  new_check text;
  roles_csv text;
  cmd_sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check, permissive
    FROM pg_policies
    WHERE schemaname='public'
      AND (qual ~ '(?<!select )auth\.(uid|role|jwt)\(\)'
        OR with_check ~ '(?<!select )auth\.(uid|role|jwt)\(\)')
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      new_qual := regexp_replace(new_qual, 'auth\.role\(\)', '(select auth.role())', 'g');
      new_qual := regexp_replace(new_qual, 'auth\.jwt\(\)', '(select auth.jwt())', 'g');
      new_qual := regexp_replace(new_qual, '\(select \(select auth\.(uid|role|jwt)\(\)\)\)', '(select auth.\1())', 'g');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      new_check := regexp_replace(new_check, 'auth\.role\(\)', '(select auth.role())', 'g');
      new_check := regexp_replace(new_check, 'auth\.jwt\(\)', '(select auth.jwt())', 'g');
      new_check := regexp_replace(new_check, '\(select \(select auth\.(uid|role|jwt)\(\)\)\)', '(select auth.\1())', 'g');
    END IF;

    roles_csv := array_to_string(ARRAY(SELECT quote_ident(unnest(r.roles))), ',');

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    cmd_sql := 'CREATE POLICY ' || quote_ident(r.policyname)
      || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename)
      || ' AS ' || CASE WHEN r.permissive='PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END
      || ' FOR ' || r.cmd
      || ' TO ' || roles_csv;

    IF new_qual IS NOT NULL THEN
      cmd_sql := cmd_sql || ' USING (' || new_qual || ')';
    END IF;
    IF new_check IS NOT NULL THEN
      cmd_sql := cmd_sql || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE cmd_sql;
  END LOOP;
END $$;
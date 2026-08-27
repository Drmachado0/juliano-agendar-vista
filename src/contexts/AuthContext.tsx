import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { getSupabase } from "@/integrations/supabase/lazy";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * O cliente Supabase chega por import dinamico, nao por import de topo.
   *
   * POR QUE: este provider envolve o app inteiro, entao o import estatico
   * tornava @supabase/supabase-js dependencia inicial da entry e colocava 48 KB
   * gzip no caminho critico de toda rota — inclusive paginas de texto puro que
   * nunca consultam nada.
   *
   * O comportamento nao muda para o usuario: tudo aqui ja rodava dentro deste
   * useEffect, ou seja, depois da montagem. `loading` continua true ate a sessao
   * ser verificada, entao quem depende dele (as rotas de admin) segue esperando
   * o mesmo sinal, so que alguns milissegundos mais tarde.
   *
   * `cancelado` existe porque agora ha um await antes da assinatura: se o
   * provider desmontar nesse intervalo, nao queremos assinar nada nem chamar
   * setState em componente morto.
   */
  useEffect(() => {
    let cancelado = false;
    let inscricao: { unsubscribe: () => void } | null = null;

    (async () => {
      const supabase = await getSupabase();
      if (cancelado) return;

      // Listener PRIMEIRO, sessao depois — a ordem importa para nao perder
      // evento disparado entre uma coisa e outra.
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event);

        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Adiado com setTimeout para evitar deadlock dentro do callback.
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
        }
      });
      inscricao = data.subscription;

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelado) return;

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await checkAdminRole(session.user.id);
      setLoading(false);
    })();

    return () => {
      cancelado = true;
      inscricao?.unsubscribe();
    };
  }, []);

  async function checkAdminRole(userId: string) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (!error && data) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('Erro ao verificar role:', err);
      setIsAdmin(false);
    }
  }

  async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  }

  async function signUp(email: string, password: string, fullName: string): Promise<{ error: Error | null }> {
    const redirectUrl = `${window.location.origin}/`;
    
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  }

  async function signOut() {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  }

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

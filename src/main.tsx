import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '@/core/crypto/kdf/pbkdf2'; // registra o PBKDF2 no catálogo de KDFs
import { bus } from '@/core/events/bus';
import { installShortcuts } from '@/core/history/shortcuts';
import { applyUpdate, registerServiceWorker } from '@/core/platform/serviceWorker';
import { registry } from '@/core/registry/ModuleRegistry';
import { abrirBanco, AppDesatualizadoError, onAppDesatualizado } from '@/core/storage/db';
import { backupModule } from '@/modules/backup';
import { categoriesModule } from '@/modules/categories';
import { notesModule } from '@/modules/notes';
import { planModule } from '@/modules/plan';
import { recurrencesModule } from '@/modules/recurrences';
import { transactionsModule } from '@/modules/transactions';
import { lock } from '@/modules/auth/service';
import { currentMonth } from '@/shared/format';
import { BackupView } from '@/ui/BackupView';
import { CategoriesView } from '@/ui/CategoriesView';
import { Dashboard } from '@/ui/Dashboard';
import { GoalsView } from '@/ui/GoalsView';
import { NotesView } from '@/ui/NotesView';
import { RecurrencesView } from '@/ui/RecurrencesView';
import { ReportsView } from '@/ui/ReportsView';
import { SettingsView } from '@/ui/SettingsView';
import { Shell, type ViewId } from '@/ui/Shell';
import { UnlockScreen } from '@/ui/UnlockScreen';
import { Workbench } from '@/ui/Workbench';
import '@/ui/theme.css';

// Registro dos módulos. Acrescentar patrimônio, investimentos ou documentos
// no futuro é uma linha aqui — o núcleo não muda.
//
// ATENÇÃO: módulo que declara tabela nunca deve ser REMOVIDO daqui. A versão do
// banco é definida por este conjunto; tirar um módulo faz a versão declarada
// cair abaixo da versão que já está gravada no navegador, e todo mundo que já
// usa a Arca cai na tela de "app desatualizado" sem saída. Para aposentar um
// módulo, pare de mostrá-lo no menu e deixe a tabela declarada.
registry.register(categoriesModule);
registry.register(transactionsModule);
registry.register(planModule);
registry.register(backupModule);
registry.register(recurrencesModule);
registry.register(notesModule);
registry.applySchema(2);

function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>('dashboard');
  const [month, setMonth] = useState(currentMonth());
  const [reloadKey, setReloadKey] = useState(0);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const off = bus.on('vault:locked', () => setUnlocked(false));
    const removeShortcuts = installShortcuts();
    registerServiceWorker(() => setUpdateReady(true));
    return () => { off(); removeShortcuts(); };
  }, []);

  async function handleUnlocked(id: string) {
    await registry.activate(id);
    setProfileId(id);
    setUnlocked(true);
  }

  const updateBanner = updateReady && (
    <div class="toast update" role="status">
      <span>Nova versão disponível</span>
      <button onClick={() => void applyUpdate()}>Atualizar</button>
      <button class="ghost" onClick={() => setUpdateReady(false)}>Depois</button>
    </div>
  );

  if (!unlocked || !profileId) {
    return (
      <>
        <UnlockScreen onUnlocked={handleUnlocked} />
        {updateBanner}
      </>
    );
  }

  return (
    <Shell view={view} onNavigate={setView} onLock={lock}>
      {view === 'dashboard' && (
        <Dashboard key={reloadKey} month={month} onChangeMonth={setMonth}
          onSeeAll={() => setView('transactions')} />
      )}
      {view === 'transactions' && (
        <Workbench key={reloadKey} month={month} onChangeMonth={setMonth} />
      )}
      {view === 'recurrences' && <RecurrencesView key={reloadKey} month={month} />}
      {view === 'categories' && <CategoriesView />}
      {view === 'reports' && <ReportsView key={reloadKey} month={month} />}
      {view === 'notes' && <NotesView key={reloadKey} />}
      {view === 'goals' && <GoalsView key={reloadKey} month={month} />}
      {view === 'backup' && (
        <BackupView onRestored={async () => {
          // Depois de restaurar, os módulos precisam recarregar os índices em
          // memória — eles ainda seguram os dados antigos.
          await registry.activate(profileId);
          setReloadKey((n) => n + 1);
        }} />
      )}
      {view === 'settings' && <SettingsView profileId={profileId} />}
      {updateBanner}
    </Shell>
  );
}

/**
 * Tela mostrada quando o banco no navegador está à frente deste código.
 *
 * Sem ela o Dexie estouraria dentro da primeira consulta e a pessoa veria
 * tela branca, sem saber que basta recarregar.
 */
function AppDesatualizado() {
  return (
    <div class="unlock-wrap" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px' }}>
      <div class="card" style={{ maxWidth: '380px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>A Arca foi atualizada</h1>
        <p style={{ opacity: 0.75, fontSize: '0.9rem', lineHeight: 1.5 }}>
          Esta aba ainda está com a versão anterior. Recarregue para continuar —
          seus lançamentos estão intactos.
        </p>
        <button style={{ marginTop: '16px' }} onClick={() => location.reload()}>
          Recarregar
        </button>
      </div>
    </div>
  );
}

// A Arca é escura, ponto. Tema claro foi removido: o usuário não o queria,
// e tema que ninguém usa é código morto que ainda precisa ser mantido.
document.documentElement.dataset['theme'] = 'dark';

const root = document.getElementById('app')!;

/**
 * Troca a interface inteira pela tela de "recarregue".
 *
 * Chamado em dois momentos: no boot, quando o banco já está à frente do
 * código; e em tempo de execução, quando outra aba com versão mais nova pede
 * para migrar o banco. No segundo caso o cofre é trancado antes — a partir
 * dali nenhuma leitura é confiável.
 */
function mostrarDesatualizado(): void {
  try {
    lock();
  } catch {
    /* cofre já trancado, ou nem chegou a abrir */
  }
  render(<AppDesatualizado />, root);
}

onAppDesatualizado(mostrarDesatualizado);

/**
 * Boot. O banco é aberto DE PROPÓSITO aqui, antes de qualquer tela.
 *
 * Se deixássemos o Dexie abrir sozinho na primeira consulta, um banco à frente
 * do código estouraria lá dentro, sem ninguém para capturar — tela branca.
 */
async function iniciar(): Promise<void> {
  try {
    await abrirBanco();
  } catch (erro) {
    // mostrarDesatualizado() já foi chamado lá do db.ts; nada a renderizar aqui.
    if (erro instanceof AppDesatualizadoError) return;
    throw erro;
  }
  render(<App />, root);
}

void iniciar();

if (import.meta.hot) import.meta.hot.accept();

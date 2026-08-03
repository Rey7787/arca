import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '@/core/crypto/kdf/pbkdf2'; // registra o PBKDF2 no catálogo de KDFs
import { bus } from '@/core/events/bus';
import { installShortcuts } from '@/core/history/shortcuts';
import { applyUpdate, registerServiceWorker } from '@/core/platform/serviceWorker';
import { registry } from '@/core/registry/ModuleRegistry';
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

// A Arca é escura, ponto. Tema claro foi removido: o usuário não o queria,
// e tema que ninguém usa é código morto que ainda precisa ser mantido.
document.documentElement.dataset['theme'] = 'dark';

render(<App />, document.getElementById('app')!);

if (import.meta.hot) import.meta.hot.accept();

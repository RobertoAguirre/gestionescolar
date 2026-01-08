<script>
  import Chatbot from './components/Chatbot.svelte';
  import AdminPanel from './components/AdminPanel.svelte';
  import PortalPadres from './components/PortalPadres.svelte';
  
  let currentView = 'chatbot';
</script>

<nav class="main-nav">
  <button 
    class:active={currentView === 'chatbot'}
    on:click={() => currentView = 'chatbot'}
  >
    💬 Chatbot
  </button>
  <button 
    class:active={currentView === 'padres'}
    on:click={() => currentView = 'padres'}
  >
    👨‍👩‍👧 Portal Padres
  </button>
  <button 
    class:active={currentView === 'admin'}
    on:click={() => currentView = 'admin'}
  >
    ⚙️ Admin
  </button>
</nav>

<main>
  {#if currentView === 'admin'}
    <AdminPanel />
  {:else if currentView === 'padres'}
    <PortalPadres />
  {:else}
    <Chatbot />
  {/if}
</main>

<style>
  .main-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: white;
    padding: 15px 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    gap: 10px;
    z-index: 1000;
    justify-content: center;
  }

  .main-nav button {
    padding: 10px 20px;
    background: #f8f9fa;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }

  .main-nav button.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: transparent;
  }

  .main-nav button:hover {
    background: #e9ecef;
  }

  .main-nav button.active:hover {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  main {
    margin-top: 70px;
    width: 100%;
    min-height: calc(100vh - 70px);
    position: relative;
  }

  .admin-link {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
  }

  .admin-link button {
    padding: 10px 20px;
    background: rgba(102, 126, 234, 0.9);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transition: background 0.2s;
  }

  .admin-link button:hover {
    background: rgba(102, 126, 234, 1);
  }
</style>



<script>
  import Chatbot from './components/Chatbot.svelte';
  import AdminPanel from './components/AdminPanel.svelte';
  
  let showAdmin = false;
  
  function toggleAdmin() {
    showAdmin = !showAdmin;
  }
</script>

<main>
  {#if showAdmin}
    <AdminPanel />
  {:else}
    <div class="admin-link">
      <button on:click={toggleAdmin}>⚙️ Admin</button>
    </div>
    <Chatbot />
  {/if}
</main>

<style>
  main {
    width: 100%;
    height: 100%;
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



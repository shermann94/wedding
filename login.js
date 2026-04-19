const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";
const supabaseKey = "sb_publishable_GprPBK44VLeb-3P7_qgOKA_WBpVkOSq";
const client = supabase.createClient(supabaseUrl, supabaseKey);

// ✅ Auto redirect if already logged in
if (localStorage.getItem("adminKey")) {
  window.location.href = "game.html";
}

async function login() {
  const inputKey = document.getElementById("password").value.trim();

  if (!inputKey) {
    alert("Please enter password");
    return;
  }

  const { data, error } = await client
    .from("game_state")
    .select("admin_key")
    .eq("id", 1)
    .single();

  if (error || !data) {
    alert("Error verifying password");
    return;
  }

  if (inputKey === data.admin_key) {
    localStorage.setItem("adminKey", inputKey);
    window.location.href = "game.html";
  } else {
    alert("Wrong password");
  }
}

// URL of your Supabase project
const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co"

// URL of your Supabase project
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU"

// Create a Supabase client so we can read/write database
const client = supabase.createClient(
  supabaseUrl,
  supabaseKey
)
// ===============================
// LOAD GAME DATA
// ===============================

// This function loads the current game settings
// from the "game_state" table
async function loadGame(){

// Query Supabase for the single row of game_state
const { data } = await client
.from("game_state")
.select("*")
.limit(1)
.single()

// Display the scenario on the big screen
document.getElementById("scenario").innerText =
data.scenario

// Display the room code for players to join
const formattedCode =
data.room_code.slice(0,4) + "-" + data.room_code.slice(4)

document.getElementById("room-code").innerText =
formattedCode

// Update how many players have joined
updatePlayerCount()

}

// Run this function when the page loads
loadGame()

// ===============================
// UPDATE PLAYER COUNT
// ===============================

// This function counts how many players joined
// and updates the lobby display
async function updatePlayerCount(){

// Ask Supabase for the total number of players
const { count } = await client
.from("players")
.select("*",{ count:'exact', head:true })

// Update the text on the screen
document.getElementById("player-count").innerText =
count + " / 100 players joined"

}



// ===============================
// REALTIME PLAYER JOIN LISTENER
// ===============================

// Subscribe to realtime database changes
// whenever someone joins the game
client
.channel("players-channel")
.on(
'postgres_changes',
{
event:'INSERT',      // Trigger when a new row is added
schema:'public',
table:'players'
},
(payload)=>{

// Update the lobby player count
updatePlayerCount()

}
)
.subscribe()



// ===============================
// REALTIME ANSWER FEED
// ===============================

// Listen for new answers submitted by players
client
.channel('game_state_updates')
.on(
'postgres_changes',
{
event:'UPDATE',      // Trigger when a new answer is inserted
schema:'public',
table:'game_state'
},
(payload) => {

// when host starts the round
if(payload.new.round_open === true){

// show the scenario card
document.getElementById("scenario-card").style.display = "block"

// load the scenario text
document.getElementById("scenario").innerText =
payload.new.scenario

}

// when host closes the round
if(payload.new.round_open === false){

// hide scenario again
document.getElementById("scenario-card").style.display = "none"

}

}
)
.subscribe()



// ===============================
// HOST CONTROL FUNCTIONS
// ===============================



// Start the round
// This unlocks the answer screen on players' phones
async function startRound(){

await client
.from("game_state")
.update({ round_open:true })
.eq("id",1)

}



// Close the round
// This stops new submissions
async function closeRound(){

await client
.from("game_state")
.update({ round_open:false })
.eq("id",1)

}



// Start the next round
// Clears answers from the screen
async function nextRound(){

// Delete all answers from database
await client
.from("answers")
.delete()
.gt("id",0)

// Clear bubbles from the screen
document.getElementById("answers").innerHTML=""

}

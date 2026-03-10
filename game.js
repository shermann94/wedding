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

  // Get game state from Supabase
  const { data, error } = await client
    .from("game_state")
    .select("*")
    .limit(1)
    .single()

  if(error){
    console.error(error)
    return
  }

  // Format room code (LOVE2026 → LOVE-2026)
  const formattedCode =
    data.room_code.slice(0,4) + "-" + data.room_code.slice(4)

  // Display room code
  document.getElementById("room-code").innerText =
    formattedCode

  // Update how many players joined
  updatePlayerCount()

  // If round already started (important for refresh)
  if(data.round_open === true){

    // show scenario card
    document.getElementById("scenario-card").style.display = "block"

    // show scenario text
    document.getElementById("scenario").innerText =
      data.scenario

  }

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
// REALTIME ANSWER FEED
// ===============================
console.log("Listening for answers...")

client
.channel("answers-channel")
.on(
'postgres_changes',
{
event:'INSERT',
schema:'public',
table:'answers'
},
(payload)=>{
console.log("Answer received:", payload)

const answer = payload.new.answer

spawnAnswerBubble(answer)

}
)
.subscribe()

// ===============================
// HOST CONTROL FUNCTIONS
// ===============================



async function startRound(){

// get current round
const { data: game } = await client
.from("game_state")
.select("*")
.eq("id",1)
.single()

const round = game.round_number

// get scenario for this round
const { data: scenarioData } = await client
.from("scenarios")
.select("*")
.eq("round_number", round)
.single()

// update game state
await client
.from("game_state")
.update({
round_open: true,
scenario: scenarioData.text
})
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



async function nextRound(){

const { data } = await client
.from("game_state")
.select("*")
.eq("id",1)
.single()

const nextRound = data.round_number + 1

if(nextRound > 3){
alert("Game finished!")
return
}

await client
.from("game_state")
.update({
round_number: nextRound,
round_open: false,
scenario: "Waiting for round to start..."
})
.eq("id",1)

// clear answers
await client
.from("answers")
.delete()
.gt("id",0)

// clear bubbles
document.getElementById("answers").innerHTML=""

}

// ===============================
// RESET GAME
// ===============================

async function resetGame(){

// close the round
await client
.from("game_state")
.update({
round_open:false,
round_number:1,
scenario:"Waiting for round to start..."
})
.eq("id",1)

// delete all answers
await client
.from("answers")
.delete()
.gt("id",0)

// clear answer bubbles on screen
document.getElementById("answers").innerHTML=""

// reload game state
loadGame()

}

// ===============================
// Spawn bubbles
// ===============================
function spawnAnswerBubble(text){

const bubble = document.createElement("div")

bubble.className = "answer-item"

bubble.innerText = text

// random position
bubble.style.left = Math.random() * 70 + "%"
bubble.style.top = Math.random() * 60 + "%"

document.getElementById("answers").appendChild(bubble)

// remove bubble after animation
setTimeout(()=>{
bubble.remove()
},4000)

}

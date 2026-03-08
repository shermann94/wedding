const supabaseUrl = "YOUR_SUPABASE_URL"
const supabaseKey = "YOUR_ANON_PUBLIC_KEY"

const client = supabase.createClient(
  supabaseUrl,
  supabaseKey
)

let maxAnswers = 100

async function loadScenario(){

const { data } = await client
.from("game_state")
.select("*")
.limit(1)
.single()

document.getElementById("scenario").innerText = data.scenario
maxAnswers = data.max_answers

}

loadScenario()

// realtime scenario updates
client
.channel('game_state_updates')
.on(
'postgres_changes',
{ event:'UPDATE', schema:'public', table:'game_state' },
(payload) => {

document.getElementById("scenario").innerText = payload.new.scenario

})
.subscribe()

// realtime answers feed
client
.channel('answers_feed')
.on(
'postgres_changes',
{ event:'INSERT', schema:'public', table:'answers' },
(payload) => {

const answer = payload.new.answer

let div = document.createElement("div")
div.innerText = answer

document.getElementById("answers").prepend(div)

updateCounter()

})
.subscribe()

async function updateCounter(){

const { count } = await client
.from("answers")
.select("*",{ count:'exact', head:true })

document.getElementById("counter").innerText =
count + " / " + maxAnswers + " submissions"

}

async function startRound(){

await client
.from("game_state")
.update({ round_open:true })
.eq("id",1)

}

async function closeRound(){

await client
.from("game_state")
.update({ round_open:false })
.eq("id",1)

}

async function nextRound(){

await client
.from("answers")
.delete()
.gt("id",0)

document.getElementById("answers").innerHTML = ""

updateCounter()

}

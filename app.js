const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU"

const client = supabase.createClient(
supabaseUrl,
supabaseKey
)

let currentScenarioId = 1

// Load scenario from database
async function loadScenario(){

  const { data, error } = await client
  .from("game_state")
  .select("*")
  .eq("id",1)
  .single()

  if(error){
    console.log(error)
    return
  }

  document.getElementById("scenario").innerText = data.scenario
  currentScenarioId = data.id

}

loadScenario()



// Submit advice
async function submitAdvice(){

  const name = document.getElementById("name").value
  const answer = document.getElementById("answer").value

  if(!name || !answer){
    alert("Please enter your name and advice")
    return
  }

  // Check if round is open
  const { data } = await client
  .from("game_state")
  .select("*")
  .eq("id",1)
  .single()

  if(!data.round_open){
    alert("Round is not open yet!")
    return
  }

  // Check submission count
  const { count } = await client
  .from("answers")
  .select("*",{ count:'exact', head:true })
  .eq("scenario_id", currentScenarioId)

  if(count >= data.max_answers){
    alert("Round is full!")
    return
  }

  // Insert answer
  const { error } = await client
  .from("answers")
  .insert([
    {
      name: name,
      answer: answer,
      scenario_id: currentScenarioId
    }
  ])

  if(error){
    console.log(error)
    alert("Something went wrong")
    return
  }

  // Disable submit button
  document.querySelector("button").disabled = true

  alert("Advice submitted! Watch the screen for results.")

}

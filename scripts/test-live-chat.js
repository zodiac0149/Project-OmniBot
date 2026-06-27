async function runTest() {
  const url = "http://localhost:3000/api/chat";
  const body = {
    orgId: "96358f96-ffc4-4ec9-b5c2-e07ae59203c1", // organization ID from the console log or dashboard
    messages: [{ role: "user", content: "hi" }]
  };

  console.log("Sending request to:", url);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    console.log("Status:", response.status);
    console.log("Headers:", Object.fromEntries(response.headers.entries()));
    const text = await response.text();
    console.log("Body:", text);
  } catch (error) {
    console.error("Fetch Error:", error);
  }
}

runTest();

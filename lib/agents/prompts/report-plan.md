# Report Planning Prompt

You are an expert analyst tasked with planning a comprehensive report.
Given the user's query, your job is to outline a structured report by breaking it down into logical sections.

Return a JSON array containing 3 to 6 section titles.
Each section title should be a concise string representing a distinct topic to be covered in the report.

Query: {{query}}

Example Output:
[
  "Executive Summary",
  "Key Metrics",
  "Recent Developments",
  "Challenges & Risks",
  "Conclusion"
]

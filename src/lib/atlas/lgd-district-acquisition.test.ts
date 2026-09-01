import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv } from "./lgd-district-acquisition";

test("CSV parser keeps quoted commas, doubled quotes and the export's doubly quoted header", () => {
  const rows = parseCsv(
    '"""stateCode""",localBodyNameEnglish,localBodyNameLocal\n' +
      '27,"Marul Haveli","मारूल हवेली"\n' +
      '27,"Vyahali, Bopegaon","a ""quoted"" name"\r\n' +
      "\n",
  );
  assert.deepEqual(rows, [
    ['"stateCode"', "localBodyNameEnglish", "localBodyNameLocal"],
    ["27", "Marul Haveli", "मारूल हवेली"],
    ["27", "Vyahali, Bopegaon", 'a "quoted" name'],
  ]);
});

test("CSV parser returns no phantom row for a trailing newline", () => {
  assert.deepEqual(parseCsv("a,b\n1,2\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

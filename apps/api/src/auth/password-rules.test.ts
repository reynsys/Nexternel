import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordProblem } from "./password-rules.js";

test("short passwords are refused", () => {
  assert.match(passwordProblem("Abc123!x", "rey") ?? "", /12 characters/);
});

test("common passwords, also with numbers or signs added, are refused", () => {
  for (const p of ["password1234", "Password1234!", "qwertyuiop123", "123456789012", "!!sunshine2026"]) {
    assert.notEqual(passwordProblem(p, "rey"), null, p);
  }
});

test("the username with numbers is refused", () => {
  assert.match(passwordProblem("reynsys20262026", "reynsys") ?? "", /username/);
});

test("too few different characters is refused", () => {
  assert.notEqual(passwordProblem("aaaaaaaaaaaabbbb", "rey"), null);
});

test("good passwords pass", () => {
  for (const p of ["blue kettle under stairs", "Tr4in-Garden-Moon", "my dog eats carrots"]) {
    assert.equal(passwordProblem(p, "rey"), null, p);
  }
});

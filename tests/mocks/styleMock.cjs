// ABOUTME: Mock for CSS imports in Jest tests
// ABOUTME: Returns empty object for all style imports to prevent parse errors
// NOTE: This file uses .cjs extension because Jest's moduleNameMapper uses require()
// which cannot load ES modules. All Jest mocks must use .cjs extension.

module.exports = {};

// Values given to the app when it is built (scripts/build.mjs), taken from the
// build's environment so they are not kept in the source code:
//   HAVIHUB_CF_KEY  the API key Havi Hub uses with CurseForge
// Empty in a build made without them, and when the code runs as it is (tests).
/* eslint-disable no-undef */
const CF_BUILD_KEY = typeof __CF_BUILD_KEY__ !== 'undefined' ? __CF_BUILD_KEY__ : '';

module.exports = { CF_BUILD_KEY };

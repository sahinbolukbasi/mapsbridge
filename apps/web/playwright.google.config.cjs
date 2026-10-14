const base=require('./playwright.config.cjs');
module.exports={...base,testDir:'./tests/google',outputDir:'./test-results-google',reporter:[['list']]};

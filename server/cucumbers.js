function createCucumberList() {
  let cucumbersList = [];
  let p = 0;

  for(let i = 0; i < 10; i++ ) {
    const cucumber = {
        id: i,
        price: p
    }
    cucumbersList.push(cucumber)
    p += 10;
  }

  return cucumbersList;
}
 
 module.exports = createCucumberList();
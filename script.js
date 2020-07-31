const data = {
  inputs: {
    variables: [
      { name: 'main', expr: 'Random', persistRand: false }
    ],
    outputs: [
      'main + Random',
      'main',
      'main + Random',
      'main'
    ]
  }
}

var app = new Vue({
  el: '#app',
  data,
  methods: {
    generate() {
      
    }
  }
})
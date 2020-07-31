const data = JSON.parse(localStorage.getItem('data')) || {
  variables: [
    {
      name: 'main',
      expr: 'Random',
      persistRand: false,
      randVals: null
    }
  ],
  parts: [
    { expr: 'main + Random'},
    { expr: 'main'},
    { expr: 'main + Random'},
    { expr: 'main'}
  ]
}

var app = new Vue({
  el: '#app',
  data,
  methods: {
    generate() {
      
    }
  },
  watch: {
    $data() {
      localStorage.setItem('data', JSON.stringify(data))
    }
  }
})
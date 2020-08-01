var data = {
  variables: [
    {
      name: 'main',
      expr: 'random()',
      randomize: true,
      randVals: null
    }
  ],
  parts: [
    { expr: 'main + random()' },
    { expr: 'main' },
    { expr: 'main + random()' },
    { expr: 'main' }
  ]
}
data = JSON.parse(localStorage.getItem('data')) || data

var app = new Vue({
  el: '#app',
  data,
  methods: {
    generate() {
      const vars = { }
      data.variables.forEach(variable => {
        const out = evaluateExpression(variable.expr, vars, variable.randomize, variable.randVals)
        vars[variable.name] = out.result
        Promise.all(
          randVals.map(rand => rand.array())
        ).then(randVals => {
          variable.randVals = randVals
        })
      })
      console.log('variables', vars)

      const parts = data.parts.map(part => evaluateExpression(part.expr, vars, true))
      parts.forEach(part => {
        part.result.print()
      })
      console.log('parts', parts)
    },
    addVariable(index) {
      const newVal = { name: '', expr: '', randomize: true, randVals: null }
      let newIndex = data.variables.length
      if (typeof index == 'number') {
        data.variables.splice(index, 0, newVal)
        newIndex = index + 1
      } else {
        data.variables.push(newVal)
      }
      
      this.$nextTick(() => {
        const el = document.getElementById('var-' + newIndex)
        el.firstChild.firstChild.focus()
      })
    },
    addPart(index) {
      const newVal = { expr: '' }
      let newIndex = data.variables.length
      if (typeof index == 'number') {
        newIndex = index + 1
        data.parts.splice(newIndex, 0, newVal)
      } else {
        data.parts.push(newVal)
      }

      this.$nextTick(() => {
        const el = document.getElementById('part-' + newIndex)
        el.firstChild.focus()
      })
    },
    keyEvent(typeKey, index, valueKey, event) {
      let value = data[typeKey][index][valueKey]

      if (event.key === 'Backspace' && value === '') {
        event.preventDefault()
        data[typeKey].splice(index, 1)

        this.$nextTick(() => {
          const el = document.getElementById('part-' + (index - 1))
          if (typeKey === 'variables') el.firstChild.firstChild.focus()
          else el.firstChild.focus()
        })
      } else if (event.key === 'Enter') {
        if (typeKey === 'variables') this.addVariable(index)
        else this.addPart(index)
      }
    }
  },
  watch: {
    $data: {
      deep: true,
      handler() {
        localStorage.setItem('data', JSON.stringify(data))
      }
    }
  }
})
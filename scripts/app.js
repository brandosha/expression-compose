var project = {
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
// const storedData = JSON.parse(localStorage.getItem('project'))
project = JSON.parse(localStorage.getItem('project')) || project

var data = {
  project,
  ready: false,
  instruments: 0
}

var sequence = JSON.parse(localStorage.getItem('sequence'))
var visualizer
var model = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar')
model.initialize().then(() => data.ready = true)

var app = new Vue({
  el: '#app',
  data,
  methods: {
    generate() {
      tf.engine().startScope()
      const promises = []

      const vars = { }
      project.variables.forEach(variable => {
        const out = evaluateExpression(variable.expr, vars, variable.randomize, variable.randVals)
        vars[variable.name] = out.result
        promises.push(
          Promise.all(randVals.map(rand => rand.array()))
          .then(randVals => {
            variable.randVals = randVals
          })
        )
      })

      const parts = project.parts.map(part => evaluateExpression(part.expr, vars, true))
      const tensorParts = []
      parts.forEach(part => {
        if (part.result instanceof tf.Tensor) tensorParts.push(part.result)
      })

      promises.push(
        model.decode(tf.stack(tensorParts))
        .then(results => {
          sequence = mm.sequences.concatenate(results)
          localStorage.setItem('sequence', JSON.stringify(sequence))
          visualizer = new mm.PianoRollSVGVisualizer(sequence, document.getElementById('viz'))
        })
      )

      Promise.all(promises).then(() => tf.engine().endScope())
    },
    addVariable(index) {
      const newVal = { name: '', expr: '', randomize: true, randVals: null }
      let newIndex = project.variables.length
      if (typeof index == 'number') {
        project.variables.splice(index, 0, newVal)
        newIndex = index + 1
      } else {
        project.variables.push(newVal)
      }
      
      this.$nextTick(() => {
        const el = document.getElementById('var-' + newIndex)
        el.firstChild.firstChild.focus()
      })
    },
    addPart(index) {
      const newVal = { expr: '' }
      let newIndex = project.variables.length
      if (typeof index == 'number') {
        newIndex = index + 1
        project.parts.splice(newIndex, 0, newVal)
      } else {
        project.parts.push(newVal)
      }

      this.$nextTick(() => {
        const el = document.getElementById('part-' + newIndex)
        el.firstChild.focus()
      })
    },
    keyEvent(typeKey, index, valueKey, event) {
      let value = project[typeKey][index][valueKey]

      if (event.key === 'Backspace' && value === '') {
        event.preventDefault()
        project[typeKey].splice(index, 1)

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
        localStorage.setItem('project', JSON.stringify(project))
      }
    }
  },
  mounted() {
    if (sequence) visualizer = new mm.PianoRollSVGVisualizer(sequence, document.getElementById('viz'))
  }
})
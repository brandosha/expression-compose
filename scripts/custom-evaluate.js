var tf = mm.tf

var functions = {
  random: (args) => {
    let rand
    if (newRand) {
      rand = tf.randomNormal([256])
      randVals.push(rand)
    } else {
      rand = randVals[randIndex]
      if (!rand) {
        rand = tf.randomNormal([256])
        randVals.push(rand)
      }
      randIndex += 1
    }
    
    return rand
  },

  add: (args) => tf.add(args[0], args[1]),
  subtract: (args) => tf.sub(args[0], args[1]),
  multiply: (args) => tf.mul(args[0], args[1]),
  divide: (args) => tf.div(args[0], args[1])
}

class EvalError extends Error { }

/**
 * @param { math.MathNode } node 
 */
function evalNode(node, variables) {
  // console.log('evaluating', node, variables)
  if (node.isFunctionNode) {
    const fnName = node.fn.name || node.fn
    if (!functions[fnName]) throw new EvalError(`Unknown function '${fnName}'`)
    return functions[fnName](node.args.map(arg => evalNode(arg, variables)))
  } else if (node.isOperatorNode) {
    const fnName = node.fn
    // console.log(fnName)
    if (!functions[fnName]) throw new EvalError(`Unknown operation '${node.op}'`)
    return functions[fnName](node.args.map(arg => evalNode(arg, variables)))
  } else if (node.isSymbolNode) {
    if (!variables[node.name]) throw new EvalError(`Unknown symbol '${node.name}'`)
    return variables[node.name]
  } else if (node.isParenthesisNode) {
    return evalNode(node.content, variables)
  } else if (node.isConstantNode) {
    return node.value
  }
  
  throw new EvalError(`${node.type.slice(0, -4)} not supported`)
}

var randVals = []
var newRand = true
var randIndex = 0
function evaluateExpression(expr, variables, randomize, prevRandVals) {
  const tree = math.parse(expr)

  if (randomize) {
    newRand = true
    randVals = []
  } else {
    newRand = false
    randVals = prevRandVals.map(arr => tf.tensor1d(arr))
    randIndex = 0
  }
  const result = evalNode(tree, variables)

  return { result, randVals }
}
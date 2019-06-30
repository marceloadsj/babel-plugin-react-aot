`babel-plugin-react-aot`

### **Experimental - Please do not use it in production**

---

## **React - Ahead of Time**

Basically, it's a extremely WIP plugin for Babel to parse **React Components** into **Vanilla Javascript Code**, removing the needed to use the React virtual dom, diff and reconciliation algorithm.

This React Code:
```javascript
function Component() {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    setInterval(() => {
      setCount(count => count + 1);
    }, 250);
  }, []);

  return (
    <div>
      Counting: {count}, {count * 2}
    </div>
  );
}
```

Turn into this Vanilla Javascript Code:
```javascript
function Component() {
  const update = {};

  const [count, setCount] = useState(() => update.count)(0);

  useEffect(() => {
    setInterval(() => {
      setCount(count => count + 1);
    }, 250);
  }, []);

  let div1, text1, text2, text3, text4;
  div1 = createElement(
    "div",
    null,
    (text1 = createTextNode("Counting: ")),
    (text2 = createTextNode(count)),
    (text3 = createTextNode(", ")),
    (text4 = createTextNode(count * 2))
  );

  update.count = count => {
    text2.data = count;
    text4.data = count * 2;
  };

  return div1;
}
```

---

### Runtime API

You can see that there are some runtime functions to help with the DOM API and the React Hooks API itself. It will be injected on the generated code when needed.

---

## License

For now, I would like to keep the project private but open sourced. After I manage to publish a stable version, I will change the license to public so, anyone can use as you want.

`If you want to contribute, fell free to create an issue :-)`
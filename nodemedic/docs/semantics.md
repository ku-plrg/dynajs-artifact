
# Node Taint Tracking Semantics

JavaScript Layer
- Strings       s
- Numbers       n
- Boolean       b       ::= true | false
- Primitives    p       ::= s | b | n
- Objects       o       ::= {s1: v1, ..., sn: vn, proto: o}
- Functions     f       ::= \this.\x.B
- Values        v       ::= o | p | f | null
- Variables     x
- Expressions   e       ::= v | x | e.e | e op e | e e
- Commands      c       ::= e | var x | x := e | x.e := e | c; c 
    -                         | () | B | error
- Blocks        B       ::= do c | () | error
- Programs      P       ::= exec B | halt
- ScopeID       Sid     ::= s
- Scope         S       ::= . | S::Sid
- Store         E       ::= . | E, (Sid, x) -> v

Judgements for Values
-   ```
    typeof v = string | number | boolean
    ------------------------------------ (Primitive)
            v Primitive
    ```
-   ```
            typeof v = object
    ------------------------------------- (Object)
                v Object
    ```
-   ```
            typeof v = function
    ------------------------------------- (Object)
                v Function
    ```
-   ```
    typeof v = null | typeof v = undefined
    --------------------------------------- (Null)
                v Null
    ```
-   ```
     heap[l] = o
    -------------- (Ref)
      ref o = l
    ```

JavaScript Operational Semantics
-   ```
    S = S'::Sid     E' := E, (x, Sid) -> 0
    -------------------------------------- (Var)
        E, S |> var x  -->  E', S |> ()
    ```
-   ```
        E, S |> c1     -->     E', S' |> c1'
    --------------------------------------------- (Seq1)
    E, S |> c1; c2      -->     E', S' |> c1'; c2
    ```
-   ```
    -------------------------------------- (Seq2)
    E, S |> (); c2     -->     E, S |> c2
    ```
-   ```
    ------------------------------------------- (Seq3)
    E, S |> error; c2     -->     E, S |> error
    ```
-   ```
        E, S |> e    -->    E, S' |> e'
    ---------------------------------------- (Assign1)
    E, S |> x := e   -->    E, S' |> x := e'
    ```
-   ```
    S = S'::Sid    E' := E, (Sid, x) -> v
    -------------------------------------- (Assign2)
    E, S |> x := v     -->     E', S |> ()
    ```
-   ```
                E[x] = v
    -------------------------------- (Read)
    E, S |> x      -->     E, S |> v
    ```
-   ```
         E, S |> e1    -->     E, S' |> e1'
    ---------------------------------------------- (BinOp1)
    E, S |> e1 op e2    -->     E, S' |> e1' op e2 
    ```
-   ```
         E, S |> e2    -->     E, S' |> e2'
    ---------------------------------------------- (BinOp2)
    E, S |> v op e2    -->     E, S' |> v op e2' 
    ```
-   ```
                v3 = op(v1, v2)
    -------------------------------------- (BinOp3)
    E, S |> v1 op v2    -->     E, S |> v3
    ```

Function Application
-   ```
        E, S |> e1     -->    E, S' |> e1'
    ------------------------------------------ (Apply1)
    E, S |> e1 e2      -->     E, S' |> e1' e2
    ```
-   ```
        E, S |> e2     -->    E, S' |> e2'
    --------------------------------------- (Apply2a)
    E, S |> f e2      -->     E, S' |> f e2
    ```
-   ```
        E, S |> e2     -->    E, S' |> e2'
    ------------------------------------------- (Apply2b)
    E, S |> o.s e2      -->     E, S' |> o.s e2
    ```
-   ```
        f = \this.\x.B      S' := S::fresh(Sid)
    ------------------------------------------------------ (Apply3a)
    E, S |> f v      -->     E, S' |> [v/x][global/this] B
    ```
-   ```
        o.s = \this.\x.B    S' := S::fresh(Sid)
    --------------------------------------------------- (Apply3b)
    E, S |> o.s v      -->     E, S' |> [v/x][o/this] B
    ```

Prototype Access
-   ```
    v = {s1: v1, ..., sn: vn, proto: o}
    ----------------------------------- (Fields)
        Fields(v) = {s1, ..., sn}
-   ```
    s != proto      s in Fields(v)
    ------------------------------ (Member1)
                s in v
    ```
-   ```
    s = proto
    --------- (Member2)
     s in v
    ```

GetField with Prototype Access
-   ```
      E, S |> e1  -->   E', S' |> e1'
    ------------------------------------- (GetField1)
    E, S |> e1.e2  -->  E', S' |> e1'.e2
    ```
-   ```
      E, S |> e2  -->   E', S' |> e2'
    ----------------------------------- (GetField2)
    E, S |> o.e2  -->   E', S' |> o.e2'
    ```
-   ```
              o[s] = v
    --------------------------- (GetField3)
    E, S |> o.s  --> E', S |> v
    ```
-   ```
      not(s in o)    o.proto = o'
    ------------------------------ (GetField4)
    E, S |> o.s  --> E', S |> o'.s
    ```
-   ```
    not(s in o)    o.proto = null
    ------------------------------ (GetField5)
    E, S |> o.s  --> E', S |> null
    ```

PutField
-   ```
            E, S |> e2    -->    E, S' |> e2'
    ------------------------------------------------ (PutField1)
    E, S |> x.e2 := e3   -->    E, S' |> x.e2' := e3
    ```
-   ```
        E, S |> e3    -->    E, S' |> e3'
    ---------------------------------------------- (PutField2)
    E, S |> x.s := e3   -->    E, S' |> x.s := e3'
    ```
-   ```
     S = S'::Sid         E[(Sid, x)] = o   
     o' := o[s -> v]     E' := E, (Sid, x) -> o'
    ------------------------------------------- (PutField3)
      E, S |> x.s := v   -->    E', S' |> ()
    ```

Blocks
-   ```
        E, S |> c   -->     E', S' |> c'
    -------------------------------------- (Block1)
    E, S |> do c   -->     E', S' |> do c'
    ```
-   ```
    S = S'::Sid    E' := E / (_, Sid)
    ------------------------------------ (Block2)
    E, S |> do ()   -->     E', S' |> ()
    ```
-   ```
        S = S'::Sid    E' := E / (_, Sid)
    ------------------------------------------ (Block3)
    E, S |> do error   -->     E', S' |> error
    ```

Programs
-   ```
        E, S |> B    -->     E', S' |> B'
    ------------------------------------------ (Program1)
    E, S |> exec B   -->     E', S' |> exec B'
    ```
-   ```
    -------------------------------------- (Program2)
    E, S |> exec ()   -->     E, S |> halt
    ```
-   ```
    ----------------------------------------- (Program3)
    E, S |> exec error   -->     E, S |> halt
    ```

Wrapper Contexts
- Wrapper map           Mw      ::= . | Mw, (ref o) -> (p, id)
- Identifier Tree       idt     ::= . | {s: idt}
- Identifiers           id      ::= s | idt
- Identifier stack      IDS     ::= . | IDS::id

Identifier Stack Operations
-   ```
      IDS' := IDS::id
    ------------------- (PutID)
    putID IDS id = IDS'
    ```
-   ```
      IDS = IDS'::id
    -------------------- (GetID1)
    getID IDS = IDS', id
    ```
-   ```
    IDS = .     id = fresh()
    ------------------------ (GetID2)
      getID IDS = IDS, id
    ```

Wrapper Map Rules
-   ```
        v \in Mw
    --------------- (Wrapped)
    Mw |- v Wrapped
    ```
-   ```
    Mw[v] = (_, id)
    --------------- (oid1)
     oid Mw v = id
    ```
-   ```
        v Object
    -----------------  (oid2)
    oid Mw v = (ref v)
    ```

Wrapper Operational Semantics
- Expressions   e   ::= ... | Wrap s e | Unwrap s e
- Prelude to all of these rules: execute e until it evaluates to v
-   ```
    v Primitive     getID IDS = IDS', id    v' = wrap(v)    Mw' := Mw, (ref v') -> (v, id)      
    -------------------------------------------------------------------------------------- (WrapPrimitive1)
                    E, S, Mw, IDS |> Wrap . v   -->     E, S, Mw', IDS' |> v'
    ```
-   ```
                            v \notin Mw    
    ----------------------------------------------------------- (UnwrapPrimitive1)
    E, S, Mw, IDS |> Unwrap . v     -->     E, S, Mw, IDS' |> v
    ```
-   ```
        Mw[v] = (v', id)    Mw' = Mw / v'   putID IDS id = IDS'
    ------------------------------------------------------------- (UnwrapPrimitive2)
    E, S, Mw, IDS |> Unwrap . v     -->     E, S, Mw', IDS' |> v'
    ```
    ```
-   ```
        v Primitive     getID IDS = IDS', idt   idt[s] = id     
        v' = wrap(v)       Mw' := Mw, (ref v') -> (v, id)      
    --------------------------------------------------------- (WrapPrimitive2)
    E, S, Mw, IDS |> Wrap s v   -->     E, S, Mw', IDS' |> v'
    ```
-   ```
        Mw[v] = (v', id)    getID IDS = IDS', idt       Mw' = Mw / v'       
            idt' = idt[s -> id]      putIDS IDS idt' = IDS'
    ----------------------------------------------------------------- (UnwrapPrimitive2)
        E, S, Mw, IDS |> Unwrap s v     -->     E, S, Mw', IDS' |> v'
    ```
    ```
-   ```
    v Object    v = {s1: v1, ..., sn: vn}   v' = {s1: vi', ..., sn: vn'}
    \forall i in {1, n} . E, S, Mwi, IDSi |> Wrap s\si vi  -->  E, S, Mwi+1, IDSi+1 |> vi'
    -------------------------------------------------------------------------------------- (WrapObject)
    E, S, Mw1, IDS1 |> Wrap s v   -->     E, S, Mwn+1, IDSn+1 |> v'
    ```
-   ```
    v Object    v = {s1: v1, ..., sn: vn}   v' = {s1: v1', ..., sn: vn'} 
    \forall i in {1, n} . E, S, Mwi, IDSi |> Unwrap s\si vi  -->  E, S, Mwi+1, IDSi+1 |> vi'
    ---------------------------------------------------------------------------------------- (UnwrapObject)
    E, S, Mw1, IDS1 |> Unwrap s v   -->     E, S, Mwn+1, IDSn+1 |> v'
    ```

Definition: Identity Preservation
- Preservation of identity is a runtime property about the evaluation of WrapperOp transformations

- \forall x \in E:

    - if       Mw |- E[x] Wrapped     and     E, S, Mw, IDS  |>  [[ c ]]   -->*   E', S', Mw', IDS'  |>  ()

    - then    Mw' |- E'[x] Wrapped    and     E[x] ~ E'[x]      and         oid Mw E[x] == oid Mw' E'[x] 

- For all of the variables in the store (todo: besides those that will be mutated by c)
    - if the variable was wrapped and [[ c ]] is fully executed
    - then the variable will still be wrapped (and is structurally the same) and its identifier before and after execution will match

Instrumentation Definitions
- Syntactic forms:
    - [[ e ]]->r        :  "(Base) Tansformation of expression e resulting in a variable named r"
    - [[ c ]]           :  "(Base) Transformation of command c"
    - Wrapper[[ e ]]->r :  "Wrapper transformation of expression e resulting in variable r"
    - Wrapper[[ e ]]    :  "Wrapper transformation of command c resulting"
    - The result variable (r) is in scope after transformation, until the end of the block's scope

Base Instrumentation
-   ```
    [[ x ]]->r = x;
    ```
-   ```
    [[ v ]]->r =
        var r; r := v;
    ```
-   ```
    [[ e1.e2 ]]->r =
        [[ e1 ]]->a1
        [[ e2 ]]->a2
        Wrapper[[ a1.a2 ]]->r
        TGetField a1 a2 r;
    ```
-   ```
    [[ e1 op e2 ]]->r =
        [[ e1 ]]->a1
        [[ e2 ]]->a2
        Wrapper[[ a1 op a2 ]]->r
        TBinOp op a1 a2 r;
    ```
-   ```
    [[ e1 e2 ]]->r =
        [[ e1 ]]->a1
        [[ e2 ]]->a2
        Wrapper[[ a1 a2 ]]->r
        TCall a1 a2 r;
    ```
-   ```
    [[ e1.e2 e3 ]]->r =
        [[ e1 ]]->a1
        [[ e2 ]]->a2
        [[ e3 ]]->a3
        Wrapper [[ a1.a2 a3]]->r
        TMCall a1 a2 a3 r;
    ```
-   ```
    [[ var x ]] = var x;
    ```
-   ```
    [[ x := e ]] =
        [[ e ]]->r
        x := r;
    ```
-   ```
    [[ e1.e2 := e3 ]] =
        [[ e1 ]]->a1
        [[ e2 ]]->a2
        [[ e3 ]]->a3
        Wrapper [[ a1.a2 := a3 ]]
    ```
-   ```
    [[ c; c ]] =
        [[ c ]]; [[ c ]]
    ```

Wrapper Instrumentation
-   ```
    Wrapper[[ x1.x2 ]]->r =
        var u1; u1 := Unwrap x1;
        var u2; u2 := Unwrap x2;
        var r; r := u1.u2;
        x2 := Wrap u2;
        x1 := Wrap u1;
        r := Wrap r;
    ```
-   ```
    Wrapper[[ x1 op x2 ]]->r =
        var u1; u1 := Unwrap x1;
        var u2; u2 := Unwrap x2;
        var r; r := u1 op u2;
        x2 := Wrap u2;
        x1 := Wrap u1;
        r := Wrap r;
    ```
-   ```
    Wrapper[[ op x ]]->r =
        var u; u := Unwrap x;
        var r; r := op u;
        x := Wrap u;
        r := Wrap r;
    ```
-   ```
    Wrapper[[ x1 x2 ]]->r =
        var u1; u1 := Unwrap x1;
        var u2; u2 := Unwrap x2;
        var r; r := u1 u2;
        x2 := Wrap u2;
        x1 := Wrap u1;
        r := Wrap r;
    ```
-   ```
    Wrapper[[ x1.x2 x3 ]]->r =
        var u1; u1 := Unwrap x1;
        var u2; u2 := Unwrap x2;
        var u3; u3 := Unwrap x3;
        var r; r := u1.u2 u3;
        x3 := Wrap u3;
        x2 := Wrap u2;
        x1 := Wrap u1;
        r := Wrap r;
    ```
-   ```
    Wrapper[[ x1.x2 := x3 ]] =
        var u1; u1 := unwrap u1;
        var u2; u2 := unwrap u2;
        u1.u2 := x3;
        x2 := wrap u2;
        x1 := wrap u1;
    ```

Taint Operational Semantics
- TaintEntry  tE  ::= {t: b, m: {s1: b, ... sn: b}}
- Taint map   Mt  ::= . | Mt, id -> tE
- Commands    c   ::= ... | TSet v b | TSetProp v s b | TGetField v1 v2 v3 
    -                     | TBinOp op v1 v2 v3 | TCall v1 v2 v3
                          | TMCall v1 v2 v3 v4 | TCheck v
-   ```
                    Mt' := Mt, (oid Mw v) -> (b, {})
    ------------------------------------------------------------------ (TSet)
    E, S, Mw, IDS, Mt |> TSet v b     -->     E, S, Mw, IDS, Mt' |> ()
    ```
-   ```
                    Mt' := Mt, (oid Mw v) -> (false, {s: b})
    -------------------------------------------------------------------- (TSetProp)
    E, S, Mw, IDS, Mt |> TSet v s b     -->     E, S, Mw, IDS, Mt' |> ()
    ```
-   ```
    Mt' := Mt, (oid Mw v3) -> ((Mt[(oid Mw v1)].t || Mt[(oid Mw v1)].m.v2), {})
    ---------------------------------------------------------------------------- (TGetField)
    E, S, Mw, IDS, Mt |> TGetField v1 v2 v3     -->     E, S, Mw, IDS, Mt' |> ()
    ```
-   ```
        Mt' := Mt, (oid Mw v3) -> ((Mt[(oid Mw v1)].t || Mt[(oid Mw v2)].t), {})
    ---------------------------------------------------------------------------- (TBinOp)
    E, S, Mw, IDS, Mt |> TBinOp op v1 v2 v3     -->     E, S, Mw, IDS, Mt' |> ()
    ```
-   ```
                  Mt' := Mt, (oid Mw v2) -> ((Mt[(oid Mw v1)].t), {})
    ---------------------------------------------------------------------------- (TUnary)
    E, S, Mw, IDS, Mt |> TUnary op v1 v2     -->     E, S, Mw, IDS, Mt' |> ()
    ```
-   ```
        v1 Native    Mt' := Mt, (oid Mw v3) -> (NativePolicy v1 v2 v3)
    ------------------------------------------------------------------------ (TCall)
    E, S, Mw, IDS, Mt |> TCall v1 v2 v3     -->     E, S, Mw, IDS, Mt' |> ()
    ```
-   ```
        v1.v2 Native    Mt' := Mt, (oid Mw v4) -> (NativePolicy v1.v2 v3 v4)
    --------------------------------------------------------------------------- (TMCall)
    E, S, Mw, IDS, Mt |> TMCall v1 v2 v3 v4     -->     E, S, Mw, IDS, Mt' |> ()
    ```
-   ```
    tE = Mt[(oid Mw v)]     tE.t = true  || \exists s in tE.m . tE[m] = true 
    ------------------------------------------------------------------------ (TCheck)
        E, S, Mw, IDS, Mt |> TCheck v     -->     E, S, Mw, IDS, Mt |> error
    ```

Definition: Precise Preservation of Semantics
- A program p has
    - Instructions I
    - State Sp
- A mechanism m has
    - State Sm
- Given a mechanism m and a program p, with traces
    - t1:   Sp1, p          -->*    Sp1', v
    - t2:   Sm, Sp2, m(p)   -->*    Sm', Sp2', v'
- Guarantee:
    - v == v'
    - m(p) contains at least the instructions that p has, in the same order
    - if Sp1 --> Sp1' and Sp2 --> Sp2' and Sp1 = Sp2 then Sp1' = Sp2'
        - *TODO*: Need weak bisimulation

Definition: Effective Preservation of Semantics
- Given a mechanism m and a program p, with traces
    - t1:   Sp1, p          -->*    Sp1', v
    - t2:   Sm, Sp2, m(p)   -->*    Sm', Sp2', v'
- Guarantee:
    - v == v'
    - m(p) contains at least the instructions that p has, in the same order
    - if Sp1 --> Sp1' and Sp2 --> Sp2' and Sp1 ~ Sp2 then Sp1' ~ Sp2'
        - *TODO*: Define Sp ~ Sp' (structural equivalence)
        - *TODO*: Need weak bisimulation


Some Notes on `undefined`
- `undefined` is still important - it is still possible (though most likely funtionally incorrect) uninitialized variables are used in some computation for any JavaScript program
- in our infrastructure, we treat undefined like any other literal.